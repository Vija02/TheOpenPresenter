import {
  ObjectToTypedMap,
  Plugin,
  PluginContext,
  ServerPluginApi,
  TRPCObject,
} from "@repo/base-plugin/server";
import { extractMediaName, streamToBuffer } from "@repo/lib";
import { logger } from "@repo/observability";
import axios from "axios";
import { createProxyMiddleware } from "http-proxy-middleware";
import { typeidUnboxed } from "typeid-js";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";
import * as Y from "yjs";
import z from "zod";

import {
  pluginName,
  remoteWebComponentTag,
  rendererWebComponentTag,
} from "./consts";
import { PluginBaseData, PluginRendererData } from "./types";

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

  // DEBT: Maybe we can cache this
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
    },
    changeOrigin: true,
  });
  const apiProxyScripts = createProxyMiddleware({
    target: "https://docs.google.com",
    changeOrigin: true,
  });

  serverPluginApi.registerPrivateRoute(pluginName, "staticProxy", apiProxy);
  serverPluginApi.registerPrivateRoute(
    pluginName,
    "staticScripts",
    apiProxyScripts,
  );

  serverPluginApi.registerKeyPressHandler(
    pluginName,
    (keyType, { rendererData }) => {
      const slideIndex = rendererData.get("slideIndex");
      const clickCount = rendererData.get("clickCount");

      if (slideIndex === null || slideIndex === undefined) {
        rendererData.set("slideIndex", 0);
        return;
      }

      if (keyType === "NEXT") {
        // TODO: We need to somehow fix the issue when clickCount passes through the slide first/last slide
        // In which case the local click count goes out of sync with the state
        rendererData.set("clickCount", (clickCount ?? 0) + 1);
      } else {
        rendererData.set("clickCount", (clickCount ?? 0) - 1);
      }
    },
  );
};

const onPluginDataCreated = (pluginInfo: ObjectToTypedMap<Plugin>) => {
  pluginInfo.get("pluginData")?.set("fetchId", null);
  pluginInfo.get("pluginData")?.set("presentationId", "");
  pluginInfo.get("pluginData")?.set("pageIds", new Y.Array());
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
  rendererData.set("resolvedSlideIndex", null);

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
          try {
            const loadedPlugin = loadedPlugins[pluginId]!;
            const loadedContextData = loadedContext[pluginId]!;

            if (loadedPlugin.pluginData.thumbnailLinks.length > 0) {
              await Promise.all(
                loadedPlugin.pluginData.thumbnailLinks.map((mediaId) =>
                  serverPluginApi.deleteMedia(mediaId).catch((err) => {
                    log.error({ err }, "Failed to delete media");
                  }),
                ),
              );
            }

            const pptMedia = await serverPluginApi.media.getMedia(mediaName);

            const res = await axios.post(
              process.env.PLUGIN_GOOGLE_SLIDES_UNOCONVERT_SERVER! +
                "/convert?convertTo=pdf",
              pptMedia,
              { responseType: "arraybuffer" },
            );

            const pdfMedia = res.data;

            log.info("Converting...");

            const output = await convertPdf(Buffer.from(pdfMedia));

            log.info("Convert done, uploading...");

            loadedPlugin.pluginData.fetchId = typeidUnboxed("fetch");
            loadedPlugin.pluginData.type = "ppt";
            loadedPlugin.pluginData.presentationId = "";
            loadedPlugin.pluginData.pageIds = [];
            loadedPlugin.pluginData.thumbnailLinks = new Array(
              output.length,
            ).fill("");
            loadedPlugin.pluginData.html = "";

            await uploadImages({
              output,
              organizationId: loadedContextData.organizationId,
              userId: ctx.userId,
              parentMediaId: extractMediaName(mediaName).mediaId,
              serverPluginApi,
              onUploaded: (uploadedMedia, i) => {
                loadedPlugin.pluginData.thumbnailLinks[i] =
                  uploadedMedia.fileName;
              },
            });

            log.info("Uploading done");
          } catch (err) {
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
          // TODO: Validate file
          const log = logger.child({ pluginId, mediaName });
          try {
            const loadedPlugin = loadedPlugins[pluginId]!;
            const loadedContextData = loadedContext[pluginId]!;

            if (loadedPlugin.pluginData.thumbnailLinks.length > 0) {
              await Promise.all(
                loadedPlugin.pluginData.thumbnailLinks.map((mediaId) =>
                  serverPluginApi.deleteMedia(mediaId).catch((err) => {
                    log.error({ err }, "Failed to delete media");
                  }),
                ),
              );
            }

            const media = await serverPluginApi.media.getMedia(mediaName);

            log.info("Converting...");

            const output = await convertPdf(await streamToBuffer(media));

            log.info("Convert done, uploading...");

            loadedPlugin.pluginData.fetchId = typeidUnboxed("fetch");
            loadedPlugin.pluginData.type = "pdf";
            loadedPlugin.pluginData.presentationId = "";
            loadedPlugin.pluginData.pageIds = [];
            loadedPlugin.pluginData.thumbnailLinks = new Array(
              output.length,
            ).fill("");
            loadedPlugin.pluginData.html = "";

            await uploadImages({
              output,
              organizationId: loadedContextData.organizationId,
              userId: ctx.userId,
              parentMediaId: extractMediaName(mediaName).mediaId,
              serverPluginApi,
              onUploaded: (uploadedMedia, i) => {
                loadedPlugin.pluginData.thumbnailLinks[i] =
                  uploadedMedia.fileName;
              },
            });

            log.info("Uploading done");
          } catch (err) {
            log.error({ err }, "Failed to select pdf");
            throw err;
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

            try {
              // TODO: Validation
              const loadedPlugin = loadedPlugins[pluginId]!;
              const loadedContextData = loadedContext[pluginId]!;
              const loadedYjs = loadedYjsData[pluginId]!;

              const presentationDataRes = await axios(
                `https://slides.googleapis.com/v1/presentations/${presentationId}`,
                {
                  headers: { Authorization: `Bearer ${token}` },
                },
              );

              const pageIds = presentationDataRes.data.slides.map(
                (page: any) => page.objectId,
              );

              const htmlData = await axios(
                `https://docs.google.com/presentation/d/${presentationId}/embed?rm=minimal`,
                {
                  headers: { Authorization: `Bearer ${token}` },
                },
              );

              if (loadedPlugin.pluginData.thumbnailLinks.length > 0) {
                await Promise.all(
                  loadedPlugin.pluginData.thumbnailLinks.map((mediaId) =>
                    serverPluginApi.deleteMedia(mediaId).catch((err) => {
                      log.error({ err }, "Failed to delete media");
                    }),
                  ),
                );
              }

              loadedYjs.doc?.transact(() => {
                loadedPlugin.pluginData.fetchId = typeidUnboxed("fetch");
                loadedPlugin.pluginData.type = "googleslides";
                loadedPlugin.pluginData.presentationId = presentationId;
                loadedPlugin.pluginData.pageIds = pageIds;
                loadedPlugin.pluginData.thumbnailLinks = new Array(
                  pageIds.length,
                ).fill("");
                loadedPlugin.pluginData.html = processHtml(htmlData.data);
              });

              log.info("Downloading PDF");
              const pdfRes = await axios(
                `https://docs.google.com/feeds/download/presentations/Export?id=${presentationId}&exportFormat=pdf`,
                {
                  headers: { Authorization: `Bearer ${token}` },
                  responseType: "arraybuffer",
                },
              );
              const pdfBuffer = Buffer.from(pdfRes.data);
              const uploadPdfPromise = serverPluginApi.uploadMedia(
                pdfBuffer,
                "pdf",
                {
                  organizationId: loadedContextData.organizationId,
                  userId: ctx.userId,
                },
              );

              log.info("Downloaded. Size: " + pdfBuffer.length);

              log.info("Converting...");

              const output = await convertPdf(pdfBuffer);

              log.info("Convert done, uploading...");

              const uploadedPdf = await uploadPdfPromise;

              await uploadImages({
                output,
                organizationId: loadedContextData.organizationId,
                userId: ctx.userId,
                parentMediaId: uploadedPdf.mediaId,
                serverPluginApi,
                onUploaded: (uploadedMedia, i) => {
                  loadedPlugin.pluginData.thumbnailLinks[i] =
                    uploadedMedia.fileName;
                },
              });

              log.info("Uploading done");

              return {};
            } catch (err) {
              log.error({ err }, "Failed to select slide");
              throw err;
            }
          },
        ),
    },
  });
};

async function convertPdf(pdfBuffer: Buffer | ArrayBuffer | Uint8Array) {
  const mupdf = await import("mupdf");

  const doc = mupdf.Document.openDocument(pdfBuffer, "application/pdf");
  const totalPage = doc.countPages();
  let scale = -1;
  const output = Array.from(new Array(totalPage)).map((_, i) => {
    const page = doc.loadPage(i);
    if (scale === -1) {
      const bounds = page.getBounds();
      const pageWidth = bounds[2] - bounds[0];

      const targetWidth = 1920;

      scale = targetWidth / pageWidth;
    }
    const pixmap = page.toPixmap(
      mupdf.Matrix.scale(scale, scale),
      mupdf.ColorSpace.DeviceRGB,
    );
    return pixmap.asJPEG(80, false);
  });

  return output;
}

async function uploadImages({
  output,
  serverPluginApi,
  organizationId,
  userId,
  parentMediaId,
  onUploaded,
}: {
  output: Uint8Array<ArrayBufferLike>[];
  serverPluginApi: ServerPluginApi<any, any>;
  organizationId: string;
  userId: string;
  parentMediaId: string;
  onUploaded: (
    data: Awaited<ReturnType<typeof serverPluginApi.uploadMedia>>,
    i: number,
  ) => void;
}) {
  // DEBT: Make this runnable somewhere else
  // The problem is, if that's the case then we'll need to store the token
  // TODO: Problem if we run this again while still running
  output.forEach(async (img, i) => {
    const uploadedMedia = await serverPluginApi.uploadMedia(
      Buffer.from(img),
      "jpg",
      {
        organizationId: organizationId,
        userId: userId,
        parentMediaIdOrUUID: parentMediaId,
      },
    );
    onUploaded(uploadedMedia, i);
  });
}

function processHtml(html: string) {
  return html
    .replace(
      /\/static\/presentation\/client\//g,
      "/plugin/google-slides/staticScripts/static/presentation/client/",
    )
    .replace(
      /https:\/\/([^.]+?)\.googleusercontent\.com/g,
      "/plugin/google-slides/staticProxy/$1",
    )
    .replace(
      /https:\\\/\\\/([^.]+?)\.googleusercontent\.com/g,
      "/plugin/google-slides/staticProxy/$1",
    );
}

export type AppRouter = ReturnType<ReturnType<typeof getAppRouter>>;

export * from "./types";
