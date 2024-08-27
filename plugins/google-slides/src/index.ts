import {
  ObjectToTypedMap,
  Plugin,
  PluginContext,
  ServerPluginApi,
} from "@repo/base-plugin/server";
import { initTRPC } from "@trpc/server";
import axios from "axios";
import { createProxyMiddleware } from "http-proxy-middleware";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";
import Y from "yjs";
import z from "zod";

import {
  pluginName,
  remoteWebComponentTag,
  rendererWebComponentTag,
} from "./consts";
import { PluginBaseData, RendererBaseData } from "./types";

export const init = (
  serverPluginApi: ServerPluginApi<PluginBaseData, RendererBaseData>,
) => {
  if (!process.env.PLUGIN_GOOGLE_SLIDES_CLIENT_ID) {
    throw new Error(
      "PLUGIN_GOOGLE_SLIDES_CLIENT_ID env var missing. Please set it to use this plugin.",
    );
  }
  serverPluginApi.registerCSPDirective(pluginName, {
    "frame-src": ["*.google.com"],
    "img-src": ["*.googleusercontent.com", "ssl.gstatic.com"],
    // We need these for Auth & Google Picker API
    "script-src": [
      "https://apis.google.com",
      "https://accounts.google.com/gsi/client",
    ],
    "connect-src": ["https://accounts.google.com/gsi/"],
    "default-src": ["https://accounts.google.com/gsi/"],
  });

  serverPluginApi.registerTrpcAppRouter(getAppRouter(serverPluginApi));
  serverPluginApi.onPluginDataCreated(pluginName, onPluginDataCreated);
  serverPluginApi.onPluginDataLoaded(pluginName, onPluginDataLoaded);
  serverPluginApi.registerSceneCreator(pluginName, {
    title: "Google Slides",
  });

  serverPluginApi.serveStatic(pluginName, "out");

  serverPluginApi.registerEnvToViews(pluginName, {
    PLUGIN_GOOGLE_SLIDES_CLIENT_ID: process.env.PLUGIN_GOOGLE_SLIDES_CLIENT_ID,
  });

  serverPluginApi.loadJsOnRemoteView(pluginName, `${pluginName}-remote.es.js`);
  serverPluginApi.registerRemoteViewWebComponent(
    pluginName,
    remoteWebComponentTag,
  );
  serverPluginApi.loadJsOnRendererView(
    pluginName,
    `${pluginName}-renderer.es.js`,
  );
  serverPluginApi.registerRendererViewWebComponent(
    pluginName,
    rendererWebComponentTag,
  );
  // serverPluginApi.registerPrivateRoute(pluginName, "proxy", (req, res) => {
  //   res.send(html);
  // });

  // TODO: Handle different regions
  // Maybe we want to cache it too?
  const apiProxy = createProxyMiddleware({
    target: "https://lh7-rt.googleusercontent.com",
    changeOrigin: true,
  });

  serverPluginApi.registerPrivateRoute(pluginName, "staticProxy", apiProxy);

  serverPluginApi.registerKeyPressHandler(
    pluginName,
    (keyType, { pluginData, rendererData }, next) => {
      const pageIds = pluginData.get("pageIds");
      const slideIndex = rendererData.get("slideIndex");

      if (slideIndex === null || slideIndex === undefined) {
        rendererData.set("slideIndex", 0);
        return;
      }

      if (keyType === "NEXT") {
        if (pageIds?._length && pageIds._length - 1 > slideIndex) {
          rendererData.set("slideIndex", slideIndex + 1);
        } else {
          next();
        }
      } else {
        if (pageIds?._length && slideIndex > 0) {
          rendererData.set("slideIndex", slideIndex - 1);
        } else {
          next();
        }
      }
    },
  );
};

const onPluginDataCreated = (pluginInfo: ObjectToTypedMap<Plugin>) => {
  pluginInfo.get("pluginData")?.set("presentationId", "");
  pluginInfo.get("pluginData")?.set("pageIds", new Y.Array());
  pluginInfo.get("pluginData")?.set("thumbnailLinks", new Y.Array());

  return {};
};

// Keep a local copy of the yjs data so that we can use it outside the initialization context
const loadedPlugins: Record<string, Plugin<PluginBaseData>> = {};
const loadedYjsData: Record<
  string,
  ObjectToTypedMap<Plugin<PluginBaseData>>
> = {};

const contextToKey = (context: PluginContext) =>
  `${context.sceneId}_${context.pluginId}`;

const onPluginDataLoaded = (
  pluginInfo: ObjectToTypedMap<Plugin<PluginBaseData>>,
  context: PluginContext,
) => {
  const data = proxy(pluginInfo.toJSON() as Plugin<PluginBaseData>);
  const unbind = bind(data, pluginInfo as any);

  loadedPlugins[contextToKey(context)] = data;
  loadedYjsData[contextToKey(context)] = pluginInfo;

  return {
    dispose: () => {
      delete loadedPlugins[contextToKey(context)];
      delete loadedYjsData[contextToKey(context)];
      unbind();
    },
  };
};

const getAppRouter =
  (serverPluginApi: ServerPluginApi) =>
  (t: ReturnType<typeof initTRPC.create>) => {
    return t.router({
      googleslides: {
        selectSlide: t.procedure
          .input(
            z.object({
              sceneId: z.string(),
              pluginId: z.string(),
              presentationId: z.string(),
              token: z.string(),
            }),
          )
          .mutation(
            async ({ input: { sceneId, pluginId, presentationId, token } }) => {
              // TODO: Validation
              const loadedPlugin =
                loadedPlugins[contextToKey({ sceneId, pluginId })]!;

              const presentationDataRes = await axios(
                `https://slides.googleapis.com/v1/presentations/${presentationId}`,
                {
                  headers: { Authorization: `Bearer ${token}` },
                },
              );

              const pageIds = presentationDataRes.data.slides.map(
                (page: any) => page.objectId,
              );

              loadedPlugin.pluginData.presentationId = presentationId;
              loadedPlugin.pluginData.pageIds = pageIds;

              // DEBT: Make this runnable somewhere else
              // The problem is, if that's the case then we'll need to store the token
              for (const pageId of pageIds) {
                const thumbnailDataRes = await axios(
                  `https://slides.googleapis.com/v1/presentations/${presentationId}/pages/${pageId}/thumbnail?thumbnailProperties.thumbnailSize=SMALL`,
                  {
                    headers: { Authorization: `Bearer ${token}` },
                  },
                );

                const picture = await axios(thumbnailDataRes.data.contentUrl, {
                  responseType: "arraybuffer",
                });

                const uploadedMedia = serverPluginApi.uploadMedia(
                  picture.data,
                  "png",
                );

                loadedPlugin.pluginData.thumbnailLinks.push(
                  uploadedMedia.newFileName,
                );
              }

              return {};
            },
          ),
      },
    });
  };

export type AppRouter = ReturnType<ReturnType<typeof getAppRouter>>;

export * from "./types";
