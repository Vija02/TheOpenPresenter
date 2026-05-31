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

import {
  pluginName,
  remoteWebComponentTag,
  rendererWebComponentTag,
} from "./consts";
import { createImageProcessor } from "./googleSlides/cacheGoogleSlideImage";
import { processHtml } from "./googleSlides/processHtml";
import { extractSlideData } from "./googleSlides/slideData/slideDataExtractor";
import {
  deleteOldMedia,
  processPdfToThumbnails,
  startThumbnailWorker,
  uploadPdfAndPrepare,
} from "./shared";
import {
  createSlideRef,
  getClickCountForSlide,
  parseSlideRef,
} from "./slideOrderUtils";
import {
  AutoplayState,
  BaseImportData,
  GoogleSlidesImportData,
  ImportData,
  PdfImportData,
  PluginBaseData,
  PluginRendererData,
  PptImportData,
} from "./types";

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
    "img-src": ["*.googleusercontent.com", "ssl.gstatic.com", "data:"],
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
  serverPluginApi.registerPrivateRoute(pluginName, "gslide/proxy", (req, res) => {
    if (!req.query?.pluginId || !req.query?.importId) {
      res.sendStatus(400);
      return;
    }
    // TODO: Authentication

    const pluginId = req.query.pluginId as string;
    const importId = req.query.importId as string;

    const loadedPlugin = loadedPlugins[pluginId];

    if (!loadedPlugin) {
      res.sendStatus(404);
      return;
    }

    const importData = loadedPlugin.pluginData.imports[importId];
    if (!importData || importData.type !== "googleslides") {
      res.sendStatus(404);
      return;
    }

    res.send(
      importData.html?.replace(
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

  serverPluginApi.registerPrivateRoute(
    pluginName,
    "gslide/userUploads",
    apiProxy,
  );
  serverPluginApi.registerPrivateRoute(
    pluginName,
    "gslide/gscripts",
    apiProxyScripts,
  );

  serverPluginApi.registerKeyPressHandler(
    pluginName,
    (keyType, { rendererData, pluginData }) => {
      const pluginDataJson = pluginData.toJSON() as PluginBaseData;
      const currentSlideIndex = rendererData.get("currentSlideIndex") ?? 0;
      const currentClickCount = rendererData.get("currentClickCount") ?? 0;
      const totalSlides = pluginDataJson.slideOrder?.length ?? 0;

      if (totalSlides === 0) {
        return;
      }

      const maxClicksForCurrentSlide = getClickCountForSlide(
        pluginDataJson,
        currentSlideIndex,
      );

      if (keyType === "NEXT") {
        if (currentClickCount < maxClicksForCurrentSlide) {
          rendererData.set("currentClickCount", currentClickCount + 1);
        } else if (currentSlideIndex < totalSlides - 1) {
          rendererData.set("currentSlideIndex", currentSlideIndex + 1);
          rendererData.set("currentClickCount", 0);
        }
        // Else: at last slide with all animations shown, do nothing
      } else if (keyType === "PREV") {
        if (currentClickCount > 0) {
          rendererData.set("currentClickCount", currentClickCount - 1);
        } else if (currentSlideIndex > 0) {
          const prevSlideIndex = currentSlideIndex - 1;
          const maxClicksForPrevSlide = getClickCountForSlide(
            pluginDataJson,
            prevSlideIndex,
          );
          rendererData.set("currentSlideIndex", prevSlideIndex);
          rendererData.set("currentClickCount", maxClicksForPrevSlide);
        }
        // Else: at first slide with click count 0, do nothing
      } else {
        logger.warn("Unknown keyType");
      }

      rendererData.set("lastClickTimestamp", Date.now());
    },
  );
};

const onPluginDataCreated = (pluginInfo: ObjectToTypedMap<Plugin>) => {
  const pluginData = pluginInfo.get("pluginData");

  pluginData?.set("imports", new Y.Map());
  pluginData?.set("slideOrder", new Y.Array());

  return {};
};

// Keep a local copy of the yjs data so that we can use it outside the initialization context
const loadedPlugins: Record<string, Plugin<PluginBaseData>> = {};
const loadedContext: Record<string, PluginContext> = {};
const loadedYjsData: Record<
  string,
  ObjectToTypedMap<Plugin<PluginBaseData>>
> = {};
const loadedRendererDataGetter: Record<
  string,
  () => Record<string, ObjectToTypedMap<PluginRendererData>>
> = {};

const onPluginDataLoaded = (
  pluginInfo: ObjectToTypedMap<Plugin<PluginBaseData>>,
  context: PluginContext,
  extras: {
    getRendererData: () => Record<string, ObjectToTypedMap<PluginRendererData>>;
  },
) => {
  const rawData = pluginInfo.toJSON() as Plugin<PluginBaseData>;

  const data = proxy(rawData);
  const unbind = bind(data, pluginInfo as any);

  // TODO: Handle this better
  for (const importData of Object.values(data.pluginData.imports)) {
    importData._isFetching = false;
  }

  loadedPlugins[context.pluginId] = data;
  loadedContext[context.pluginId] = context;
  loadedYjsData[context.pluginId] = pluginInfo;
  loadedRendererDataGetter[context.pluginId] = extras.getRendererData;

  return {
    dispose: () => {
      delete loadedPlugins[context.pluginId];
      delete loadedContext[context.pluginId];
      delete loadedYjsData[context.pluginId];
      delete loadedRendererDataGetter[context.pluginId];
      unbind();
    },
  };
};

const onRendererDataCreated = (
  rendererData: ObjectToTypedMap<Partial<PluginRendererData>>,
) => {
  rendererData.set("currentSlideIndex", null);
  rendererData.set("currentClickCount", null);
  rendererData.set("lastClickTimestamp", null);

  const autoPlay = new Y.Map() as TypedMap<AutoplayState>;
  autoPlay.set("enabled", false);
  autoPlay.set("loopDurationMs", 10000);
  rendererData.set("autoplay", autoPlay as any);

  return {};
};

const getAppRouter = (serverPluginApi: ServerPluginApi) => (t: TRPCObject) => {
  const cleanupImportMedia = (importData: ImportData) => {
    if (importData.pdfMediaName) {
      deleteOldMedia(serverPluginApi, [importData.pdfMediaName]);
    }
  };
  function getBaseImport(
    type: ImportData["type"],
    name?: string,
    replaceImportId?: string,
  ): BaseImportData {
    return {
      importId: typeidUnboxed("import"),
      type,
      name,
      fetchId: typeidUnboxed("fetch"),
      thumbnailLinks: [],
      slideClickCounts: [],
      slideIds: [],
      _isFetching: true,
      ...(replaceImportId && { replaceImportId }),
    };
  }

  const buildReplacedSlideOrder = (
    oldOrder: string[],
    replaceImportId: string,
    newImportId: string,
    newSlideCount: number,
  ): string[] => {
    const survivingIndices = new Set<number>();
    const rebuilt: string[] = [];
    let lastSurvivingPos = -1;

    for (const ref of oldOrder) {
      const { importId, slideIndex } = parseSlideRef(ref);

      // Refs from other imports stay exactly where they are.
      if (importId !== replaceImportId) {
        rebuilt.push(ref);
        continue;
      }

      // Drop slides that no longer exist or that we've already kept.
      const slideStillExists = slideIndex < newSlideCount;
      const alreadyKept = survivingIndices.has(slideIndex);
      if (!slideStillExists || alreadyKept) continue;

      // Keep, rewriting to the new import id.
      survivingIndices.add(slideIndex);
      rebuilt.push(createSlideRef(newImportId, slideIndex));
      lastSurvivingPos = rebuilt.length - 1;
    }

    // Append brand-new slides after the last surviving slide of this import.
    const newSlides: string[] = [];
    for (let i = 0; i < newSlideCount; i++) {
      if (!survivingIndices.has(i)) {
        newSlides.push(createSlideRef(newImportId, i));
      }
    }
    if (newSlides.length > 0) {
      const insertAt =
        lastSurvivingPos >= 0 ? lastSurvivingPos + 1 : rebuilt.length;
      rebuilt.splice(insertAt, 0, ...newSlides);
    }

    return rebuilt;
  };

  /**
   * Handles both appending & replacing
   */
  const finalizeImport = ({
    loadedPlugin,
    newImportId,
    slideCount,
    replaceImportId,
  }: {
    loadedPlugin: Plugin<PluginBaseData>;
    newImportId: string;
    slideCount: number;
    replaceImportId?: string;
  }) => {
    const oldImport = replaceImportId
      ? loadedPlugin.pluginData.imports[replaceImportId]
      : undefined;

    // Append functionality
    if (!replaceImportId || !oldImport) {
      const newRefs = Array.from({ length: slideCount }, (_, i) =>
        createSlideRef(newImportId, i),
      );
      loadedPlugin.pluginData.slideOrder = [
        ...loadedPlugin.pluginData.slideOrder,
        ...newRefs,
      ];
      return;
    }

    // Replace functionality

    // 1. Drop the old import from the imports map.
    const { [replaceImportId]: _removed, ...remainingImports } =
      loadedPlugin.pluginData.imports;
    loadedPlugin.pluginData.imports = remainingImports;

    // 2. Rebuild slideOrder, preserving manual ordering.
    loadedPlugin.pluginData.slideOrder = buildReplacedSlideOrder(
      loadedPlugin.pluginData.slideOrder,
      replaceImportId,
      newImportId,
      slideCount,
    );

    // 3. Clean up the thumbnails and uploaded PDF
    cleanupImportMedia(oldImport);
  };

  return t.router({
    slides: {
      selectPpt: t.procedure
        .input(
          z.object({
            pluginId: z.string(),
            mediaName: z.string(),
            name: z.string().optional(),
            replaceImportId: z.string().optional(),
          }),
        )
        .mutation(
          async ({
            input: { pluginId, mediaName, name, replaceImportId },
            ctx,
          }) => {
            if (!process.env.PLUGIN_GOOGLE_SLIDES_UNOCONVERT_SERVER) {
              throw new Error("Not available");
            }

            const log = logger.child({ pluginId, mediaName, replaceImportId });
            const loadedPlugin = loadedPlugins[pluginId]!;
            const loadedContextData = loadedContext[pluginId]!;

            const newImport = getBaseImport(
              "ppt",
              name,
              replaceImportId,
            ) as PptImportData;
            loadedPlugin.pluginData.imports[newImport.importId] = newImport;

            try {
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

              const { fileNames, workerPromise, uploadedPdfFileName } =
                await processPdfToThumbnails(
                  {
                    serverPluginApi,
                    organizationId: loadedContextData.organizationId,
                    userId: ctx.userId,
                    projectId: loadedContextData.projectId,
                    pluginId,
                  },
                  pdfBuffer,
                  log,
                  undefined,
                  extractMediaName(mediaName).mediaId,
                );

              loadedPlugin.pluginData.imports[
                newImport.importId
              ]!.thumbnailLinks = fileNames;
              loadedPlugin.pluginData.imports[
                newImport.importId
              ]!.slideClickCounts = fileNames.map(() => 0);
              loadedPlugin.pluginData.imports[newImport.importId]!.slideIds =
                fileNames.map((_, i) => String(i));
              loadedPlugin.pluginData.imports[
                newImport.importId
              ]!.pdfMediaName = uploadedPdfFileName;

              // Wait for thumbnails to be uploaded
              await workerPromise;

              loadedPlugin.pluginData.imports[newImport.importId]!._isFetching =
                false;

              finalizeImport({
                loadedPlugin,
                newImportId: newImport.importId,
                slideCount: fileNames.length,
                replaceImportId,
              });

              return { importId: newImport.importId };
            } catch (err) {
              const { [newImport.importId]: _, ...remaining } =
                loadedPlugin.pluginData.imports;
              loadedPlugin.pluginData.imports = remaining;
              log.error({ err }, "Failed to import ppt");
              throw err;
            }
          },
        ),

      selectPdf: t.procedure
        .input(
          z.object({
            pluginId: z.string(),
            mediaName: z.string(),
            name: z.string().optional(),
            replaceImportId: z.string().optional(),
          }),
        )
        .mutation(
          async ({
            input: { pluginId, mediaName, name, replaceImportId },
            ctx,
          }) => {
            const log = logger.child({ pluginId, mediaName, replaceImportId });
            const loadedPlugin = loadedPlugins[pluginId]!;
            const loadedContextData = loadedContext[pluginId]!;

            const newImport = getBaseImport(
              "pdf",
              name,
              replaceImportId,
            ) as PdfImportData;
            loadedPlugin.pluginData.imports[newImport.importId] = newImport;

            try {
              const media = await serverPluginApi.media.getMedia(mediaName);
              const pdfBuffer = await streamToBuffer(media);

              const { fileNames, workerPromise, uploadedPdfFileName } =
                await processPdfToThumbnails(
                  {
                    serverPluginApi,
                    organizationId: loadedContextData.organizationId,
                    userId: ctx.userId,
                    projectId: loadedContextData.projectId,
                    pluginId,
                  },
                  pdfBuffer,
                  log,
                  mediaName,
                );

              loadedPlugin.pluginData.imports[
                newImport.importId
              ]!.pdfMediaName = uploadedPdfFileName;
              loadedPlugin.pluginData.imports[
                newImport.importId
              ]!.thumbnailLinks = fileNames;
              loadedPlugin.pluginData.imports[
                newImport.importId
              ]!.slideClickCounts = fileNames.map(() => 0);
              loadedPlugin.pluginData.imports[newImport.importId]!.slideIds =
                fileNames.map((_, i) => String(i));

              // Wait for thumbnails to be uploaded
              await workerPromise;

              loadedPlugin.pluginData.imports[newImport.importId]!._isFetching =
                false;

              finalizeImport({
                loadedPlugin,
                newImportId: newImport.importId,
                slideCount: fileNames.length,
                replaceImportId,
              });

              return { importId: newImport.importId };
            } catch (err) {
              const { [newImport.importId]: _, ...remaining } =
                loadedPlugin.pluginData.imports;
              loadedPlugin.pluginData.imports = remaining;
              log.error({ err }, "Failed to import pdf");
              throw err;
            }
          },
        ),

      selectSlide: t.procedure
        .input(
          z.object({
            pluginId: z.string(),
            presentationId: z.string(),
            token: z.string(),
            name: z.string().optional(),
            replaceImportId: z.string().optional(),
          }),
        )
        .mutation(
          async ({
            input: { pluginId, presentationId, token, name, replaceImportId },
            ctx,
          }) => {
            const log = logger.child({
              pluginId,
              presentationId,
              replaceImportId,
            });
            const loadedPlugin = loadedPlugins[pluginId]!;
            const loadedContextData = loadedContext[pluginId]!;
            const loadedYjs = loadedYjsData[pluginId]!;

            const startTime = Date.now();

            const newImport: GoogleSlidesImportData = {
              ...getBaseImport("googleslides", name, replaceImportId),
              type: "googleslides",
              presentationId,
              html: "",
            };
            loadedPlugin.pluginData.imports[newImport.importId] = newImport;

            try {
              // Step 1: Fetch HTML embed
              log.info("Fetching HTML embed");
              const htmlData = await axios(
                `https://docs.google.com/presentation/d/${presentationId}/embed?rm=minimal`,
                {
                  headers: { Authorization: `Bearer ${token}` },
                },
              );

              const ctx_media = {
                serverPluginApi,
                organizationId: loadedContextData.organizationId,
                userId: ctx.userId,
                projectId: loadedContextData.projectId,
                pluginId,
              };

              // Step 2: Start image downloads immediately
              log.info(
                "Starting image downloads and PDF download in parallel...",
              );
              const imageProcessor = createImageProcessor(
                htmlData.data,
                ctx_media,
              );

              // Step 3: Download PDF in parallel with image downloads
              const pdfRes = await axios(
                `https://docs.google.com/feeds/download/presentations/Export?id=${presentationId}&exportFormat=pdf`,
                {
                  headers: { Authorization: `Bearer ${token}` },
                  responseType: "arraybuffer",
                },
              );
              const pdfBuffer = Buffer.from(pdfRes.data);
              log.info(`Downloaded PDF (${pdfBuffer.length} bytes)`);

              // Step 4: Upload PDF
              const {
                fileNames,
                mediaIds,
                uploadedPdfMediaId,
                uploadedPdfFileName,
              } = await uploadPdfAndPrepare(ctx_media, pdfBuffer);

              loadedPlugin.pluginData.imports[
                newImport.importId
              ]!.thumbnailLinks = fileNames;
              loadedPlugin.pluginData.imports[
                newImport.importId
              ]!.pdfMediaName = uploadedPdfFileName;

              log.info("PDF uploaded. Signaling image uploads to start...");
              imageProcessor.setParentMediaId(uploadedPdfMediaId);

              // Step 5: Run thumbnail worker in parallel with remaining image uploads
              const [_, urlMapping] = await Promise.all([
                startThumbnailWorker(
                  ctx_media,
                  uploadedPdfFileName,
                  mediaIds,
                  uploadedPdfMediaId,
                  log,
                ),
                imageProcessor.result,
              ]);

              log.info("All images processed");

              // Process HTML and extract slide data
              const processedHtml = processHtml(htmlData.data, urlMapping);
              const slideData = extractSlideData(processedHtml);

              if (!slideData) {
                log.error(
                  { processedHtml },
                  "Unable to extract data from slide",
                );
              }

              const slideIds = slideData
                ? slideData.slides.map((slide) => slide.slideId)
                : fileNames.map((_, i) => String(i));
              const slideClickCounts = slideData
                ? slideData.slides.map((slide) => slide.clickCount)
                : fileNames.map(() => 0);

              loadedYjs.doc?.transact(() => {
                loadedPlugin.pluginData.imports[
                  newImport.importId
                ]!.slideClickCounts = slideClickCounts;
                loadedPlugin.pluginData.imports[newImport.importId]!.slideIds =
                  slideIds;
                (
                  loadedPlugin.pluginData.imports[
                    newImport.importId
                  ]! as GoogleSlidesImportData
                ).html = processedHtml;
                loadedPlugin.pluginData.imports[
                  newImport.importId
                ]!._isFetching = false;

                finalizeImport({
                  loadedPlugin,
                  newImportId: newImport.importId,
                  slideCount: fileNames.length,
                  replaceImportId,
                });
              });

              const elapsed = Date.now() - startTime;
              log.info(
                {
                  durationMs: elapsed,
                  slideCount: slideClickCounts.length,
                  cachedImages: urlMapping.size,
                },
                `Google Slides import completed in ${elapsed}ms`,
              );

              return { importId: newImport.importId };
            } catch (err) {
              const { [newImport.importId]: _, ...remaining } =
                loadedPlugin.pluginData.imports;
              loadedPlugin.pluginData.imports = remaining;
              log.error({ err }, "Failed to import google slide");
              throw err;
            }
          },
        ),

      removeImport: t.procedure
        .input(
          z.object({
            pluginId: z.string(),
            importId: z.string(),
          }),
        )
        .mutation(async ({ input: { pluginId, importId } }) => {
          const loadedPlugin = loadedPlugins[pluginId]!;
          const loadedYjs = loadedYjsData[pluginId]!;
          const getRendererData = loadedRendererDataGetter[pluginId];

          const importData = loadedPlugin.pluginData.imports[importId];
          if (!importData) return;

          if (importData.pdfMediaName) {
            deleteOldMedia(serverPluginApi, [importData.pdfMediaName]);
          }

          const oldSlideOrder = [...loadedPlugin.pluginData.slideOrder];
          const newSlideOrder = oldSlideOrder.filter(
            (ref) => parseSlideRef(ref).importId !== importId,
          );

          loadedYjs.doc?.transact(() => {
            // 1. Drop the import data
            const { [importId]: _, ...remainingImports } =
              loadedPlugin.pluginData.imports;
            loadedPlugin.pluginData.imports = remainingImports;

            // 2. Strip slideOrder
            loadedPlugin.pluginData.slideOrder = newSlideOrder;

            // 3. Update renderer state
            const rendererMap = getRendererData?.() ?? {};
            for (const rendererData of Object.values(rendererMap)) {
              const displayModes = rendererData.get("displayModes");
              if (displayModes && displayModes.has(importId)) {
                displayModes.delete(importId);
              }

              const currentIdx = rendererData.get("currentSlideIndex");
              if (currentIdx === null || currentIdx === undefined) continue;

              const oldRef = oldSlideOrder[currentIdx];
              const newIdx =
                oldRef !== undefined ? newSlideOrder.indexOf(oldRef) : -1;

              if (newIdx === -1) {
                rendererData.set("currentSlideIndex", null);
                rendererData.set("currentClickCount", null);
              } else {
                rendererData.set("currentSlideIndex", newIdx);
              }
            }
          });
        }),

      // // Move a slide in the order
      // moveSlide: t.procedure
      //   .input(
      //     z.object({
      //       pluginId: z.string(),
      //       fromIndex: z.number(),
      //       toIndex: z.number(),
      //     }),
      //   )
      //   .mutation(async ({ input: { pluginId, fromIndex, toIndex } }) => {
      //     const loadedPlugin = loadedPlugins[pluginId]!;
      //     const slideOrder = [...loadedPlugin.pluginData.slideOrder];

      //     if (
      //       fromIndex < 0 ||
      //       fromIndex >= slideOrder.length ||
      //       toIndex < 0 ||
      //       toIndex >= slideOrder.length
      //     ) {
      //       return;
      //     }

      //     const [removed] = slideOrder.splice(fromIndex, 1);
      //     slideOrder.splice(toIndex, 0, removed!);

      //     loadedPlugin.pluginData.slideOrder = slideOrder;
      //   }),
    },
  });
};

export type AppRouter = ReturnType<ReturnType<typeof getAppRouter>>;

export * from "./types";
