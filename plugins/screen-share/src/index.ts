import {
  AwarenessContext,
  ObjectToTypedMap,
  Plugin,
  RegisterOnRendererDataCreated,
  ServerPluginApi,
} from "@repo/base-plugin/server";
import { logger as rawLogger } from "@repo/observability";
import crypto from "crypto";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";

import {
  pluginName,
  remoteWebComponentTag,
  rendererWebComponentTag,
} from "./consts";
import { IceServer, PluginBaseData, PluginRendererData } from "./types";

export const init = (serverPluginApi: ServerPluginApi) => {
  serverPluginApi.onPluginDataCreated(pluginName, onPluginDataCreated);
  serverPluginApi.onPluginDataLoaded(pluginName, onPluginDataLoaded);
  serverPluginApi.onRendererDataCreated(pluginName, onRendererDataCreated);
  serverPluginApi.registerSceneCreator(pluginName, {
    title: "Screen Share",
    description: "Share your screen live to any display",
    categories: ["Display"],
  });

  serverPluginApi.serveStatic(pluginName, "out");

  serverPluginApi.loadJsOnRemoteView(pluginName, `${pluginName}-remote.es.js`);
  serverPluginApi.loadCssOnRemoteView(pluginName, `RemoteEntry.css`);
  serverPluginApi.registerRemoteViewWebComponent(
    pluginName,
    remoteWebComponentTag,
    // Keep the sender mounted even when the operator navigates to another
    // scene, so an active share survives.
    { alwaysRender: true },
  );
  serverPluginApi.loadJsOnRendererView(
    pluginName,
    `${pluginName}-renderer.es.js`,
  );
  serverPluginApi.registerRendererViewWebComponent(
    pluginName,
    rendererWebComponentTag,
  );

  serverPluginApi.registerPrivateRoute(
    pluginName,
    "ice-servers",
    (req, res) => {
      if (req.method !== "GET") {
        res.sendStatus(405);
        return;
      }
      res.json(buildIceServers());
    },
  );
};

const onPluginDataCreated = (
  pluginInfo: ObjectToTypedMap<Plugin<PluginBaseData>>,
) => {
  const pluginData = pluginInfo.get("pluginData");
  pluginData?.set("isSharing", false);
  pluginData?.set("sharerAwarenessUserId", null);
  pluginData?.set("sessionId", null);

  return {};
};

const onPluginDataLoaded = (
  pluginInfo: ObjectToTypedMap<Plugin<PluginBaseData>>,
) => {
  const logger = rawLogger.child({
    plugin: pluginInfo.get("plugin"),
  });

  const data = proxy(pluginInfo.toJSON() as Plugin<PluginBaseData>);
  const unbind = bind(data, pluginInfo as any);

  const getAwarenessState = (awareness: AwarenessContext["awarenessObj"]) => {
    return Array.from(awareness.getStates().values()) as any[];
  };

  // If the client that owns the active share disconnects, reset the sharing
  // state so renderers stop trying to connect to a ghost
  const handleCurrentData = () => {
    if (!data.pluginData.isSharing) {
      return;
    }

    const state = getAwarenessState(pluginInfo.doc!.awareness);
    const allUserIds = state.map((x) => x?.user?.id);

    if (
      data.pluginData.sharerAwarenessUserId &&
      !allUserIds.includes(data.pluginData.sharerAwarenessUserId)
    ) {
      logger.debug(
        { sharerAwarenessUserId: data.pluginData.sharerAwarenessUserId },
        "Sharer disconnected, resetting screen share state",
      );
      data.pluginData.isSharing = false;
      data.pluginData.sharerAwarenessUserId = null;
      data.pluginData.sessionId = null;
    }
  };
  handleCurrentData();
  pluginInfo.doc?.awareness.on("change", handleCurrentData);

  return {
    dispose: () => {
      unbind();
      pluginInfo.doc?.awareness.off("change", handleCurrentData);
    },
  };
};

const onRendererDataCreated: RegisterOnRendererDataCreated<
  PluginRendererData
> = () => {
  return {};
};

/**
 * Build the ICE server list handed to the browser.
 *
 * - A public STUN server is always included (enough for same-LAN and most
 *   NATs). Override with TURN_STUN_URL.
 * - If TURN is configured it is added too. Two modes:
 *   - Ephemeral (recommended): set TURN_URL + TURN_SECRET. We mint short-lived
 *     coturn REST credentials (HMAC-SHA1) so no long-lived secret hits the
 *     browser.
 *   - Static: set TURN_URL + TURN_USERNAME + TURN_PASSWORD.
 *   TURN_URL may be a comma-separated list (e.g. udp + tcp + tls variants).
 *
 * With no TURN_* env set, the plugin runs STUN-only — fine for cloud/LAN, but
 * the hardest symmetric-NAT cases won't connect until TURN is deployed.
 */
const buildIceServers = (): IceServer[] => {
  const iceServers: IceServer[] = [];

  const stunUrl = process.env.TURN_STUN_URL || "stun:stun.l.google.com:19302";
  iceServers.push({ urls: stunUrl });

  const turnUrl = process.env.TURN_URL;
  if (turnUrl) {
    const urls = turnUrl
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const secret = process.env.TURN_SECRET;

    if (secret) {
      const ttlSeconds = parseInt(process.env.TURN_TTL || "86400", 10);
      const username = `${Math.floor(Date.now() / 1000) + ttlSeconds}`;
      const credential = crypto
        .createHmac("sha1", secret)
        .update(username)
        .digest("base64");
      iceServers.push({ urls, username, credential });
    } else if (process.env.TURN_USERNAME && process.env.TURN_PASSWORD) {
      iceServers.push({
        urls,
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_PASSWORD,
      });
    }
  }

  return iceServers;
};

export * from "./types";
