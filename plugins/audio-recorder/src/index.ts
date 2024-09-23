import {
  AwarenessContext,
  ObjectToTypedMap,
  Plugin,
  ServerPluginApi,
} from "@repo/base-plugin/server";
import { initTRPC } from "@trpc/server";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";
import Y from "yjs";

import {
  pluginName,
  remoteWebComponentTag,
  rendererWebComponentTag,
} from "./consts";
import { PluginBaseData } from "./types";

export const init = (serverPluginApi: ServerPluginApi) => {
  serverPluginApi.registerTrpcAppRouter(getAppRouter);
  serverPluginApi.onPluginDataCreated(pluginName, onPluginDataCreated);
  serverPluginApi.onPluginDataLoaded(pluginName, onPluginDataLoaded);
  serverPluginApi.registerSceneCreator(pluginName, {
    title: "Audio Recorder",
  });

  serverPluginApi.serveStatic(pluginName, "out");

  serverPluginApi.loadJsOnRemoteView(pluginName, `${pluginName}-remote.es.js`);
  serverPluginApi.registerRemoteViewWebComponent(
    pluginName,
    remoteWebComponentTag,
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
};

const onPluginDataCreated = (
  pluginInfo: ObjectToTypedMap<Plugin<PluginBaseData>>,
) => {
  pluginInfo
    .get("pluginData")
    ?.set("recordings", new Y.Array() as ObjectToTypedMap<[]>);
  pluginInfo
    .get("pluginData")
    ?.set("activeStreams", new Y.Array() as ObjectToTypedMap<[]>);

  return {};
};

const onPluginDataLoaded = (
  pluginInfo: ObjectToTypedMap<Plugin<PluginBaseData>>,
) => {
  const data = proxy(pluginInfo.toJSON() as Plugin<PluginBaseData>);
  const unbind = bind(data, pluginInfo as any);

  // When loaded, there can't be any streams connected. So we can nuke the option
  data.pluginData.activeStreams = [];
  data.pluginData.recordings = data.pluginData.recordings.filter(
    (x) => !!x.mediaId,
  );
  // Clean up recordings. Same as before, there can't be anything recording right now
  data.pluginData.recordings.forEach((x, i) => {
    if (x.status === "recording") {
      data.pluginData.recordings[i]!.status = "ended";
      data.pluginData.recordings[i]!.endedAt = new Date().toISOString();
    }
  });

  // Then we can watch the awareness and purge those that doesn't exist anymore
  const getAwarenessState = (awareness: AwarenessContext["awarenessObj"]) => {
    return Array.from(awareness.getStates().values()) as any[];
  };

  const onAwarenessChange = () => {
    const state = getAwarenessState(pluginInfo.doc!.awareness);

    const allUserIds = state.map((x) => x.user.id);

    for (let i = data.pluginData.activeStreams.length - 1; i >= 0; i--) {
      const activeStream = data.pluginData.activeStreams[i]!;
      if (!allUserIds.includes(activeStream?.awarenessUserId)) {
        data.pluginData.activeStreams.splice(i, 1);
      }
    }

    const allActiveStreamIds = data.pluginData.activeStreams.map(
      (stream) => stream.streamId,
    );

    for (let i = data.pluginData.recordings.length - 1; i >= 0; i--) {
      const recording = data.pluginData.recordings[i]!;
      if (
        recording.status !== "ended" &&
        !allActiveStreamIds.includes(recording?.streamId)
      ) {
        if (recording.status === "pending") {
          data.pluginData.recordings.splice(i, 1);
        } else if (recording.status === "recording") {
          recording.status = "ended";
          recording.endedAt = new Date().toISOString();
        }
      }
    }
  };
  pluginInfo.doc?.awareness.on("change", onAwarenessChange);

  return {
    dispose: () => {
      unbind();
      pluginInfo.doc?.awareness.off("change", onAwarenessChange);
    },
  };
};

const getAppRouter = (t: ReturnType<typeof initTRPC.create>) => {
  return t.router({});
};

export type AppRouter = ReturnType<typeof getAppRouter>;

export * from "./types";
