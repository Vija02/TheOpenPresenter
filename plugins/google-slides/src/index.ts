import {
  ObjectToTypedMap,
  Plugin,
  PluginContext,
  ServerPluginApi,
} from "@repo/base-plugin/server";
import { initTRPC } from "@trpc/server";
import axios from "axios";
import { SyntaxKind, parse as parseHtml, walk as walkHtml } from "html5parser";
import { createProxyMiddleware } from "http-proxy-middleware";
import { parse as parseJs, print } from "recast";
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
  serverPluginApi.registerCSPDirective(pluginName, {
    "frame-src": ["docs.google.com"],
    "img-src": ["*.googleusercontent.com", "ssl.gstatic.com"],
  });

  serverPluginApi.registerTrpcAppRouter(getAppRouter);
  serverPluginApi.onPluginDataCreated(pluginName, onPluginDataCreated);
  serverPluginApi.onPluginDataLoaded(pluginName, onPluginDataLoaded);
  serverPluginApi.registerSceneCreator(pluginName, {
    title: "Google Slides",
  });

  serverPluginApi.serveStatic(pluginName, "out");

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
  serverPluginApi.registerPrivateRoute(pluginName, "proxy", (req, res) => {
    res.send(html);
  });

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
      const slideIds = pluginData.get("slideIds");
      const slideIndex = rendererData.get("slideIndex");

      if (slideIndex === null || slideIndex === undefined) {
        rendererData.set("slideIndex", 0);
        return;
      }

      if (keyType === "NEXT") {
        if (slideIds?._length && slideIds._length - 1 > slideIndex) {
          rendererData.set("slideIndex", slideIndex + 1);
        } else {
          next();
        }
      } else {
        if (slideIds?._length && slideIndex > 0) {
          rendererData.set("slideIndex", slideIndex - 1);
        } else {
          next();
        }
      }
    },
  );
};

const onPluginDataCreated = (pluginInfo: ObjectToTypedMap<Plugin>) => {
  pluginInfo.get("pluginData")?.set("slideLink", "");
  pluginInfo.get("pluginData")?.set("slideIds", new Y.Array());

  return {};
};

const loadedPlugins: Record<string, Plugin<PluginBaseData>> = {};

const contextToKey = (context: PluginContext) =>
  `${context.sceneId}_${context.pluginId}`;

const onPluginDataLoaded = (
  pluginInfo: ObjectToTypedMap<Plugin>,
  context: PluginContext,
) => {
  const data = proxy(pluginInfo.toJSON() as Plugin<PluginBaseData>);
  const unbind = bind(data, pluginInfo as any);

  loadedPlugins[contextToKey(context)] = data;

  return {
    dispose: () => {
      delete loadedPlugins[contextToKey(context)];
      unbind();
    },
  };
};

let html = "";

const getAppRouter = (t: ReturnType<typeof initTRPC.create>) => {
  return t.router({
    googleslides: {
      setLink: t.procedure
        .input(
          z.object({
            sceneId: z.string(),
            pluginId: z.string(),
            slideLink: z.string(),
          }),
        )
        .mutation(async ({ input: { sceneId, pluginId, slideLink } }) => {
          // TODO: Validation
          const loadedPlugin =
            loadedPlugins[contextToKey({ sceneId, pluginId })]!;

          if (slideLink !== "") {
            const googleSlideHtmlData = await axios.get(slideLink);
            const rawHtml = googleSlideHtmlData.data;
            // TODO:
            html = processHtml(rawHtml);
            const htmlAst = parseHtml(rawHtml);

            walkHtml(htmlAst, {
              enter(node) {
                if (node.type === SyntaxKind.Tag && node.name === "script") {
                  const firstNode = node.body?.[0];
                  if (
                    firstNode?.type === SyntaxKind.Text &&
                    firstNode.value.includes("var viewerData =")
                  ) {
                    const scriptText = firstNode.value.replace(/\n/g, "\\n");

                    const jsAst = parseJs(scriptText);
                    const result = print(
                      jsAst.program.body[1].declarations[0].init,
                    );
                    const extractedData = eval(`(${result.code})`);

                    const slideIds = extractedData.docData[1].map(
                      (x: any) => x[0],
                    );

                    loadedPlugin.pluginData.slideIds = slideIds;
                    loadedPlugin.pluginData.slideLink = slideLink;
                  }
                }
              },
            });
          }
        }),
      proxy: t.procedure
        .input(
          z.object({
            slideLink: z.string(),
          }),
        )
        .query(async (opts) => {
          return html;
        }),
    },
  });
};

function processHtml(html: string) {
  return html
    .replace(
      /\/static\/presentation\/client\//g,
      "/plugin/google-slides/static/gs-scripts/",
    )
    .replace(
      /https:\/\/lh7-rt\.googleusercontent\.com/g,
      "/plugin/google-slides/staticProxy",
    )
    .replace(
      /https:\\\/\\\/lh7-rt\.googleusercontent\.com/g,
      "/plugin/google-slides/staticProxy",
    );
}

export type AppRouter = ReturnType<typeof getAppRouter>;

export * from "./types";
