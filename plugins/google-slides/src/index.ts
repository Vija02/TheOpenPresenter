import {
  ObjectToTypedMap,
  Plugin,
  PluginContext,
  ServerPluginApi,
  TRPCObject,
} from "@repo/base-plugin/server";
import { TypedMap, extractMediaName, streamToBuffer } from "@repo/lib";
import { logger } from "@repo/observability";
import axios from "axios";
import { createProxyMiddleware } from "http-proxy-middleware";
import { typeidUnboxed } from "typeid-js";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";
import * as Y from "yjs";
import z from "zod";

import { clampClickCount } from "./clickCountUtils";
import {
  pluginName,
  remoteWebComponentTag,
  rendererWebComponentTag,
} from "./consts";
import { cacheGoogleUserContentImages } from "./googleSlides/cacheGoogleSlideImage";
import { processHtml } from "./googleSlides/processHtml";
import { extractSlideData } from "./googleSlides/slideDataExtractor";
import { deleteOldThumbnails, processPdfToThumbnails } from "./shared";
import { AutoplayState, PluginBaseData, PluginRendererData } from "./types";

export const init = (
  serverPluginApi: ServerPluginApi<PluginBaseData, PluginRendererData>,
) => {
  if (!process.env.PLUGIN_GOOGLE_SLIDES_CLIENT_ID) {
    throw new Error(
      "PLUGIN_GOOGLE_SLIDES_CLIENT_ID env var missing. Please set it to use this plugin.",
    );
  }
  serverPluginApi.registerCSPDirective(pluginName, {
    "frame-src": ["'self'", "*.google.com"],
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
  serverPluginApi.onRendererDataCreated(pluginName, onRendererDataCreated);
  serverPluginApi.registerSceneCreator(pluginName, {
    title: "Slides",
    description:
      "Import & display presentations from PPT, Google Slides and more",
    categories: ["Display"],
  });

  serverPluginApi.serveStatic(pluginName, "out");

  serverPluginApi.registerEnvToViews(pluginName, {
    PLUGIN_GOOGLE_SLIDES_CLIENT_ID: process.env.PLUGIN_GOOGLE_SLIDES_CLIENT_ID,
  });

  serverPluginApi.loadJsOnRemoteView(pluginName, `${pluginName}-remote.es.js`);
  serverPluginApi.loadCssOnRemoteView(pluginName, "RemoteEntry.css");
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
    if (!req.query?.pluginId) {
      res.sendStatus(400);
      return;
    }
    // TODO: Authentication

    const key = req.query.pluginId as string;

    const loadedPlugin = loadedPlugins[key];

    if (!loadedPlugin) {
      res.sendStatus(404);
      return;
    }

    res.send(
      loadedPlugin?.pluginData.html?.replace(
        /nonce="(.+?)"/g,
        `nonce="${res.locals.nonce}"`,
      ) ?? "",
    );
  });

  const apiProxy = createProxyMiddleware({
    pathRewrite: (path) => {
      return "/" + path.split("/").slice(2).join("/");
    },
    router: (req) => {
      return `https://${req.url?.split("/")[1]}.googleusercontent.com`;
    },
    on: {
      proxyReq: (proxyReq) => {
        proxyReq.removeHeader("Referer");
      },
      proxyRes: (proxyRes) => {
        proxyRes.headers["cache-control"] =
          "public, max-age=31536000, immutable";
      },
    },
    changeOrigin: true,
  });
  const apiProxyScripts = createProxyMiddleware({
    target: "https://docs.google.com",
    changeOrigin: true,
    on: {
      proxyRes: (proxyRes) => {
        proxyRes.headers["cache-control"] =
          "public, max-age=31536000, immutable";
      },
    },
  });

  serverPluginApi.registerPrivateRoute(pluginName, "staticProxy", apiProxy);
  serverPluginApi.registerPrivateRoute(
    pluginName,
    "staticScripts",
    apiProxyScripts,
  );

  serverPluginApi.registerKeyPressHandler(
    pluginName,
    (keyType, { rendererData, pluginData }) => {
      const slideIndex = rendererData.get("slideIndex");
      const clickCount = rendererData.get("clickCount");
      const slideClickCounts =
        (pluginData.get("slideClickCounts")?.toJSON() as number[]) ?? [];

      if (slideIndex === null || slideIndex === undefined) {
        rendererData.set("slideIndex", 0);
        return;
      }

      const newClickCount =
        keyType === "NEXT" ? (clickCount ?? 0) + 1 : (clickCount ?? 0) - 1;

      const clampedClickCount = clampClickCount({
        clickCount: newClickCount,
        slideIndex,
        slideClickCounts,
      });

      rendererData.set("clickCount", clampedClickCount);
    },
  );
};

const onPluginDataCreated = (pluginInfo: ObjectToTypedMap<Plugin>) => {
  pluginInfo.get("pluginData")?.set("fetchId", null);
  pluginInfo.get("pluginData")?.set("presentationId", "");
  pluginInfo.get("pluginData")?.set("slideClickCounts", new Y.Array());
  pluginInfo.get("pluginData")?.set("thumbnailLinks", new Y.Array());
  pluginInfo.get("pluginData")?.set("_isFetching", false);

  return {};
};

// Keep a local copy of the yjs data so that we can use it outside the initialization context
const loadedPlugins: Record<string, Plugin<PluginBaseData>> = {};
const loadedContext: Record<string, PluginContext> = {};
const loadedYjsData: Record<
  string,
  ObjectToTypedMap<Plugin<PluginBaseData>>
> = {};

const onPluginDataLoaded = (
  pluginInfo: ObjectToTypedMap<Plugin<PluginBaseData>>,
  context: PluginContext,
) => {
  const data = proxy(pluginInfo.toJSON() as Plugin<PluginBaseData>);
  const unbind = bind(data, pluginInfo as any);

  // Migrate from old type
  if (!data.pluginData.fetchId) {
    if (data.pluginData.presentationId !== "") {
      data.pluginData.fetchId = typeidUnboxed("fetch");
    } else {
      data.pluginData.fetchId = null;
    }
  }

  // Migrate: Extract slideClickCounts from HTML if not present
  if (
    (!data.pluginData.slideClickCounts ||
      data.pluginData.slideClickCounts.length === 0) &&
    data.pluginData.html
  ) {
    const slideData = extractSlideData(data.pluginData.html);
    if (slideData) {
      data.pluginData.slideClickCounts = slideData.slides.map(
        (slide) => slide.clickCount,
      );
    }
  }

  // Initialize slideClickCounts if still not present
  if (!data.pluginData.slideClickCounts) {
    data.pluginData.slideClickCounts = [];
  }

  // Reset fetching state on load
  data.pluginData._isFetching = false;

  loadedPlugins[context.pluginId] = data;
  loadedContext[context.pluginId] = context;
  loadedYjsData[context.pluginId] = pluginInfo;

  return {
    dispose: () => {
      delete loadedPlugins[context.pluginId];
      delete loadedContext[context.pluginId];
      delete loadedYjsData[context.pluginId];
      unbind();
    },
  };
};

const onRendererDataCreated = (
  rendererData: ObjectToTypedMap<Partial<PluginRendererData>>,
) => {
  rendererData.set("slideIndex", null);
  rendererData.set("clickCount", null);
  rendererData.set("lastClickTimestamp", null);

  const autoPlay = new Y.Map() as TypedMap<AutoplayState>;
  autoPlay.set("enabled", false);
  autoPlay.set("loopDurationMs", 10000);
  rendererData.set("autoplay", autoPlay as any);

  return {};
};

const getAppRouter = (serverPluginApi: ServerPluginApi) => (t: TRPCObject) => {
  return t.router({
    googleslides: {
      selectPpt: t.procedure
        .input(
          z.object({
            pluginId: z.string(),
            mediaName: z.string(),
          }),
        )
        .mutation(async ({ input: { pluginId, mediaName }, ctx }) => {
          // TODO: Validate file
          if (!process.env.PLUGIN_GOOGLE_SLIDES_UNOCONVERT_SERVER) {
            throw new Error("Not available");
          }

          const log = logger.child({ pluginId, mediaName });
          const loadedPlugin = loadedPlugins[pluginId]!;
          const loadedContextData = loadedContext[pluginId]!;

          try {
            deleteOldThumbnails(
              serverPluginApi,
              loadedPlugin.pluginData.thumbnailLinks,
            );

            // Get PPT and convert to PDF using unoconvert
            const pptMedia = await serverPluginApi.media.getMedia(mediaName);
            log.info("Converting PPT to PDF via unoconvert...");

            const res = await axios.post(
              process.env.PLUGIN_GOOGLE_SLIDES_UNOCONVERT_SERVER! +
                "/convert?convertTo=pdf",
              pptMedia,
              { responseType: "arraybuffer" },
            );

            const pdfBuffer = Buffer.from(res.data);
            log.info("PPT converted to PDF");

            const { fileNames, workerPromise } = await processPdfToThumbnails({
              serverPluginApi,
              pdfBuffer,
              parentMediaId: extractMediaName(mediaName).mediaId,
              organizationId: loadedContextData.organizationId,
              userId: ctx.userId,
              projectId: loadedContextData.projectId,
              pluginId,
              loadedPlugin,
              log,
            });

            // Update plugin data immediately with pre-generated file names
            // For PPT, no animation spupport for now. Each slide set to 0 click
            const slideClickCounts = fileNames.map(() => 0);
            loadedPlugin.pluginData._isFetching = true;
            loadedPlugin.pluginData.fetchId = typeidUnboxed("fetch");
            loadedPlugin.pluginData.type = "ppt";
            loadedPlugin.pluginData.presentationId = "";
            loadedPlugin.pluginData.slideClickCounts = slideClickCounts;
            loadedPlugin.pluginData.thumbnailLinks = fileNames;
            loadedPlugin.pluginData.html = "";

            await workerPromise;
          } catch (err) {
            loadedPlugin.pluginData._isFetching = false;
            log.error({ err }, "Failed to select ppt");
            throw err;
          }
        }),
      selectPdf: t.procedure
        .input(
          z.object({
            pluginId: z.string(),
            mediaName: z.string(),
          }),
        )
        .mutation(async ({ input: { pluginId, mediaName }, ctx }) => {
          const log = logger.child({ pluginId, mediaName });
          const loadedPlugin = loadedPlugins[pluginId]!;
          const loadedContextData = loadedContext[pluginId]!;

          try {
            loadedPlugin.pluginData._isFetching = true;

            deleteOldThumbnails(
              serverPluginApi,
              loadedPlugin.pluginData.thumbnailLinks,
            );

            const media = await serverPluginApi.media.getMedia(mediaName);
            const pdfBuffer = await streamToBuffer(media);

            const { fileNames, workerPromise } = await processPdfToThumbnails({
              serverPluginApi,
              pdfBuffer,
              pdfMediaName: mediaName,
              organizationId: loadedContextData.organizationId,
              userId: ctx.userId,
              projectId: loadedContextData.projectId,
              pluginId,
              loadedPlugin,
              log,
            });

            // Update plugin data
            // For PDF, each slide has 0 click animations (no animation support)
            const slideClickCounts = fileNames.map(() => 0);
            loadedPlugin.pluginData.fetchId = typeidUnboxed("fetch");
            loadedPlugin.pluginData.type = "pdf";
            loadedPlugin.pluginData.presentationId = "";
            loadedPlugin.pluginData.slideClickCounts = slideClickCounts;
            loadedPlugin.pluginData.thumbnailLinks = fileNames;
            loadedPlugin.pluginData.html = "";

            await workerPromise;
          } catch (err) {
            log.error({ err }, "Failed to select pdf");
            throw err;
          } finally {
            loadedPlugin.pluginData._isFetching = false;
          }
        }),
      selectSlide: t.procedure
        .input(
          z.object({
            pluginId: z.string(),
            presentationId: z.string(),
            token: z.string(),
          }),
        )
        .mutation(
          async ({ input: { pluginId, presentationId, token }, ctx }) => {
            const log = logger.child({ pluginId, presentationId });
            const loadedPlugin = loadedPlugins[pluginId]!;
            const loadedContextData = loadedContext[pluginId]!;
            const loadedYjs = loadedYjsData[pluginId]!;

            try {
              loadedPlugin.pluginData._isFetching = true;

              deleteOldThumbnails(
                serverPluginApi,
                loadedPlugin.pluginData.thumbnailLinks,
              );

              // Fetch HTML embed
              const htmlData = await axios(
                `https://docs.google.com/presentation/d/${presentationId}/embed?rm=minimal`,
                {
                  headers: { Authorization: `Bearer ${token}` },
                },
              );

              log.info("Downloading PDF");
              const pdfRes = await axios(
                `https://docs.google.com/feeds/download/presentations/Export?id=${presentationId}&exportFormat=pdf`,
                {
                  headers: { Authorization: `Bearer ${token}` },
                  responseType: "arraybuffer",
                },
              );
              const pdfBuffer = Buffer.from(pdfRes.data);

              log.info("Downloaded PDF. Size: " + pdfBuffer.length);

              // Process PDF to thumbnails
              const { fileNames, uploadedPdfMediaId, workerPromise } =
                await processPdfToThumbnails({
                  serverPluginApi,
                  pdfBuffer,
                  organizationId: loadedContextData.organizationId,
                  userId: ctx.userId,
                  projectId: loadedContextData.projectId,
                  pluginId,
                  loadedPlugin,
                  log,
                });

              // Extract and cache Google user content images from HTML
              log.info("Caching Google user content images...");
              const urlMapping = await cacheGoogleUserContentImages(
                htmlData.data,
                {
                  serverPluginApi,
                  organizationId: loadedContextData.organizationId,
                  userId: ctx.userId,
                  parentMediaId: uploadedPdfMediaId,
                  projectId: loadedContextData.projectId,
                  pluginId,
                },
              );
              log.info("Google user content images cached");

              // Process HTML and extract slide data
              const processedHtml = processHtml(htmlData.data, urlMapping);
              const slideData = extractSlideData(processedHtml);
              const slideClickCounts = slideData
                ? slideData.slides.map((slide) => slide.clickCount)
                : [];

              log.info(
                { slideCount: slideClickCounts.length },
                "Extracted slide click counts",
              );

              // Update plugin data with presentation info, HTML, and pre-generated thumbnails
              loadedYjs.doc?.transact(() => {
                loadedPlugin.pluginData.fetchId = typeidUnboxed("fetch");
                loadedPlugin.pluginData.type = "googleslides";
                loadedPlugin.pluginData.presentationId = presentationId;
                loadedPlugin.pluginData.slideClickCounts = slideClickCounts;
                loadedPlugin.pluginData.thumbnailLinks = fileNames;
                loadedPlugin.pluginData.html = processedHtml;
              });

              await workerPromise;
            } catch (err) {
              log.error({ err }, "Failed to select slide");
              throw err;
            } finally {
              loadedPlugin.pluginData._isFetching = false;
            }
          },
        ),
    },
  });
};

export type AppRouter = ReturnType<ReturnType<typeof getAppRouter>>;

export * from "./types";
