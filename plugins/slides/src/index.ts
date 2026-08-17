import {
  ObjectToTypedMap,
  Plugin,
  PluginContext,
  ServerPluginApi,
  TRPCObject,
} from "@repo/base-plugin/server";
import {
  TypedMap,
  extractMediaName,
  isPubliclyAccessibleUrl,
  streamToBuffer,
} from "@repo/lib";
import { logger } from "@repo/observability";
import axios from "axios";
import { createProxyMiddleware } from "http-proxy-middleware";
import path from "path";
import { typeidUnboxed } from "typeid-js";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";
import * as Y from "yjs";
import z from "zod";

import { getCanvaOAuthConfig } from "./canva/oauth";
import { createCanvaRouter } from "./canva/router";
import { registerCanvaRoutes } from "./canva/routes";
import {
  pluginName,
  remoteWebComponentTag,
  rendererWebComponentTag,
} from "./consts";
import { isCustomImport, rebuildOrderAfterSlideRemoval } from "./customSlides";
import { createImageProcessor } from "./googleSlides/cacheGoogleSlideImage";
import { processHtml } from "./googleSlides/processHtml";
import { extractSlideData } from "./googleSlides/slideData/slideDataExtractor";
import { convertPptToPdfViaOfficeOnline } from "./office/convertPptToPdf";
import { isOnline } from "./office/network";
import {
  deleteOldMedia,
  processPdfToThumbnails,
  startThumbnailWorker,
  uploadPdfAndPrepare,
} from "./shared";
import {
  createSlideRef,
  getAutoplayDurationForSlide,
  getClickCountForSlide,
  getClickDurationForSlide,
  getTransitionDurationForSlide,
  parseSlideRef,
} from "./slideOrderUtils";
import {
  AutoplayState,
  BaseImportData,
  CustomImportData,
  GoogleSlidesImportData,
  ImageImportData,
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
  const canvaEnabled = getCanvaOAuthConfig() !== null;

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

  serverPluginApi.registerMigrations(
    pluginName,
    path.join(__dirname, "../migrations"),
  );

  if (canvaEnabled) {
    registerCanvaRoutes(serverPluginApi);
  } else {
    logger.info(
      "Canva integration disabled (PLUGIN_SLIDES_CANVA_CLIENT_ID / _SECRET not set)",
    );
  }

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
    PLUGIN_SLIDES_CANVA_ENABLED: canvaEnabled ? "1" : "",
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
  serverPluginApi.registerPrivateRoute(
    pluginName,
    "gslide/proxy",
    (req, res) => {
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
    },
  );

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

      const now = Date.now();
      const transitionEndsAt = rendererData.get("transitionEndsAt") ?? 0;
      const isTransitioningBackwards =
        rendererData.get("isTransitioningBackwards") ?? false;

      // Wrap every mutation in a single transaction so all changes for one
      // key press are applied atomically.
      rendererData.doc?.transact(() => {
        rendererData.set("lastClickTimestamp", now);
        // Default off; only a backward slide-boundary crossing re-arms it below.
        rendererData.set("isTransitioningBackwards", false);

        // Handle transitioning backwards which has special behaviors
        if (isTransitioningBackwards && now < transitionEndsAt) {
          if (keyType === "NEXT") {
            // Cancel it and return to base click count
            const returningSlideIndex = currentSlideIndex + 1;
            const returningHasAutoplay =
              getAutoplayDurationForSlide(pluginDataJson, returningSlideIndex) >
              0;
            rendererData.set("currentSlideIndex", returningSlideIndex);
            rendererData.set(
              "currentClickCount",
              returningHasAutoplay ? -1 : 0,
            );
            rendererData.set("transitionEndsAt", 0);
            return;
          }
          if (keyType === "PREV") {
            // Snap on the highest click count
            rendererData.set("currentClickCount", maxClicksForCurrentSlide);
            rendererData.set("transitionEndsAt", 0);
            return;
          }
        }

        if (keyType === "NEXT") {
          // If last object on slide & not finished transition yet
          if (
            currentClickCount >= maxClicksForCurrentSlide &&
            now < transitionEndsAt
          ) {
            // Then clicking next should only skip the transition and not move anything else
            rendererData.set("transitionEndsAt", 0);
          } else if (currentClickCount < maxClicksForCurrentSlide) {
            // Otherwise if there's more to click, just go next
            const nextClickCount = currentClickCount + 1;
            rendererData.set("currentClickCount", nextClickCount);
            const clickDuration = getClickDurationForSlide(
              pluginDataJson,
              currentSlideIndex,
              nextClickCount,
            );
            rendererData.set("transitionEndsAt", now + clickDuration);
          } else if (currentSlideIndex < totalSlides - 1) {
            const nextSlideIndex = currentSlideIndex + 1;
            rendererData.set("currentSlideIndex", nextSlideIndex);
            rendererData.set("currentClickCount", 0);
            const slideTransitionDurationMs = getTransitionDurationForSlide(
              pluginDataJson,
              nextSlideIndex,
            );
            const autoplayDurationMs = getAutoplayDurationForSlide(
              pluginDataJson,
              nextSlideIndex,
            );
            rendererData.set(
              "transitionEndsAt",
              now +
                slideTransitionDurationMs +
                (autoplayDurationMs > 0 ? autoplayDurationMs : 0),
            );
          }
          // Else: at last slide with all animations shown, do nothing
        } else if (keyType === "PREV") {
          // Clear any forward boundary window. Backward object steps (build
          // undo, autoplay-rewind) are instant, so they get no window; the
          // slide-boundary branch below re-arms it for the reverse transition,
          // which does animate.
          rendererData.set("transitionEndsAt", 0);

          if (currentClickCount > 0) {
            rendererData.set("currentClickCount", currentClickCount - 1);
          } else if (
            currentClickCount === 0 &&
            getAutoplayDurationForSlide(pluginDataJson, currentSlideIndex) > 0
          ) {
            rendererData.set("currentClickCount", -1);
          } else if (currentSlideIndex > 0) {
            const prevSlideIndex = currentSlideIndex - 1;
            const maxClicksForPrevSlide = getClickCountForSlide(
              pluginDataJson,
              prevSlideIndex,
            );
            rendererData.set("currentSlideIndex", prevSlideIndex);
            rendererData.set("currentClickCount", maxClicksForPrevSlide);

            // Unlike object builds, a slide transition plays backwards with the
            // same duration it has forward. The transition that reverses is the
            // one belonging to the slide we're leaving (currentSlideIndex) —
            // the same transition played when entering it. Arm the window so
            // the renderer knows the reverse animation is in flight.
            const reverseTransitionMs = getTransitionDurationForSlide(
              pluginDataJson,
              currentSlideIndex,
            );
            rendererData.set("transitionEndsAt", now + reverseTransitionMs);
            rendererData.set("isTransitioningBackwards", true);
          }
          // Else: at first slide with click count 0, do nothing
        } else {
          logger.warn("Unknown keyType");
        }
      });
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

  /**
   * Drop an entire import and every slide it contributed.
   *
   * Shared by `removeImport` and by `removeCustomSlide` when it deletes the
   * last slide of a deck — a deck with no slides would otherwise linger in the
   * Settings list with nothing to show.
   */
  const removeImportById = (pluginId: string, importId: string) => {
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
            if (!process.env.ROOT_URL) {
              throw new Error(
                "ROOT_URL env var missing. It is required so Office Online can fetch the uploaded file.",
              );
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
              const rootUrl =
                process.env.PUBLIC_ROOT_URL ?? process.env.ROOT_URL;
              let publicPptUrl: string;

              if (isPubliclyAccessibleUrl(rootUrl)) {
                publicPptUrl = `${rootUrl}/media/data/${mediaName}`;
              } else {
                if (!(await isOnline())) {
                  throw new Error(
                    "Converting PowerPoint isn't available offline yet. Please connect to the internet and try again.",
                  );
                }
                // Local/self-host with internet access:
                // Proxy our files through cloud server
                const proxyRes = await axios.post(
                  `${rootUrl}/device/host/media-proxy-url`,
                  { mediaName },
                  {
                    headers: { "x-top-csrf-protection": "1" },
                    validateStatus: () => true,
                  },
                );
                if (proxyRes.status !== 200 || !proxyRes.data?.url) {
                  throw new Error(
                    "Unable to convert PowerPoint on this device. Please make sure you are connected the internet.",
                  );
                }
                publicPptUrl = proxyRes.data.url as string;
              }

              log.info(
                { publicPptUrl },
                "Converting PPT to PDF via Office Online...",
              );

              const pdfBuffer = await convertPptToPdfViaOfficeOnline(
                publicPptUrl,
                log,
              );
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
              log.error({ err }, "Failed to import PPT");
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
      selectImage: t.procedure
        .input(
          z.object({
            pluginId: z.string(),
            images: z.array(
              z.object({
                mediaName: z.string(),
                name: z.string().optional(),
              }),
            ),
            replaceImportId: z.string().optional(),
          }),
        )
        .mutation(async ({ input: { pluginId, images, replaceImportId } }) => {
          const log = logger.child({ pluginId, replaceImportId });
          const loadedPlugin = loadedPlugins[pluginId]!;

          const newImportIds: string[] = [];
          let currentReplaceId = replaceImportId;

          try {
            for (const img of images) {
              const newImport = getBaseImport(
                "image",
                img.name,
                currentReplaceId,
              ) as ImageImportData;

              loadedPlugin.pluginData.imports[newImport.importId] = newImport;

              loadedPlugin.pluginData.imports[
                newImport.importId
              ]!.thumbnailLinks = [img.mediaName];
              loadedPlugin.pluginData.imports[
                newImport.importId
              ]!.slideClickCounts = [0];
              loadedPlugin.pluginData.imports[newImport.importId]!.slideIds = [
                "0",
              ];
              loadedPlugin.pluginData.imports[newImport.importId]!._isFetching =
                false;

              finalizeImport({
                loadedPlugin,
                newImportId: newImport.importId,
                slideCount: 1,
                replaceImportId: currentReplaceId,
              });

              newImportIds.push(newImport.importId);
              currentReplaceId = undefined;
            }

            return { importIds: newImportIds };
          } catch (err) {
            // rollback something fails
            for (const id of newImportIds) {
              const { [id]: _, ...remaining } = loadedPlugin.pluginData.imports;
              loadedPlugin.pluginData.imports = remaining;
            }
            log.error({ err }, "Failed to import image(s)");
            throw err;
          }
        }),

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
              const slideTransitionDurations = slideData
                ? slideData.slides.map(
                    (slide) => slide.slideTransitionDurationMs,
                  )
                : fileNames.map(() => 0);
              const slideClickDurations: number[][] = slideData
                ? slideData.slides.map((slide) => slide.clickDurationsMs)
                : fileNames.map(() => [] as number[]);
              const slideAutoplayDurations = slideData
                ? slideData.slides.map(
                    (slide) => slide.autoplayObjectDurationMs,
                  )
                : fileNames.map(() => 0);

              loadedYjs.doc?.transact(() => {
                loadedPlugin.pluginData.imports[
                  newImport.importId
                ]!.slideClickCounts = slideClickCounts;
                (
                  loadedPlugin.pluginData.imports[
                    newImport.importId
                  ]! as GoogleSlidesImportData
                ).slideTransitionDurations = slideTransitionDurations;
                (
                  loadedPlugin.pluginData.imports[
                    newImport.importId
                  ]! as GoogleSlidesImportData
                ).slideClickDurations = slideClickDurations;
                (
                  loadedPlugin.pluginData.imports[
                    newImport.importId
                  ]! as GoogleSlidesImportData
                ).slideAutoplayDurations = slideAutoplayDurations;
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

      ...createCanvaRouter(t, {
        serverPluginApi,
        loadedPlugins,
        loadedContext,
        getBaseImport,
        finalizeImport,
      }),

      removeImport: t.procedure
        .input(
          z.object({
            pluginId: z.string(),
            importId: z.string(),
          }),
        )
        .mutation(async ({ input: { pluginId, importId } }) => {
          removeImportById(pluginId, importId);
        }),

      removeCustomSlide: t.procedure
        .input(
          z.object({
            pluginId: z.string(),
            importId: z.string(),
            slideIndex: z.number().int().min(0),
          }),
        )
        .mutation(async ({ input: { pluginId, importId, slideIndex } }) => {
          const loadedPlugin = loadedPlugins[pluginId]!;
          const loadedYjs = loadedYjsData[pluginId]!;
          const getRendererData = loadedRendererDataGetter[pluginId];

          const importData = loadedPlugin.pluginData.imports[importId];
          if (!isCustomImport(importData)) return;
          if (slideIndex >= importData.docs.length) return;

          // Last slide standing: the deck itself is what should go
          if (importData.docs.length <= 1) {
            removeImportById(pluginId, importId);
            return;
          }

          const oldSlideOrder = [...loadedPlugin.pluginData.slideOrder];
          const newSlideOrder = rebuildOrderAfterSlideRemoval(
            oldSlideOrder,
            importId,
            slideIndex,
          );
          const removedPos = oldSlideOrder.indexOf(
            createSlideRef(importId, slideIndex),
          );

          loadedYjs.doc?.transact(() => {
            const target = loadedPlugin.pluginData.imports[
              importId
            ] as CustomImportData;

            target.docs = target.docs.filter((_, i) => i !== slideIndex);
            target.slideIds = target.slideIds.filter(
              (_, i) => i !== slideIndex,
            );
            target.slideClickCounts = target.slideClickCounts.filter(
              (_, i) => i !== slideIndex,
            );

            loadedPlugin.pluginData.slideOrder = newSlideOrder;

            if (removedPos === -1) return;

            const rendererMap = getRendererData?.() ?? {};
            for (const rendererData of Object.values(rendererMap)) {
              const currentIdx = rendererData.get("currentSlideIndex");
              if (currentIdx === null || currentIdx === undefined) continue;
              if (currentIdx < removedPos) continue;

              if (currentIdx > removedPos) {
                rendererData.set("currentSlideIndex", currentIdx - 1);
                continue;
              }

              // The live slide was the one deleted. Hold the position so the
              // next slide moves up into view rather than blanking the output.
              const clamped = Math.min(removedPos, newSlideOrder.length - 1);
              rendererData.set(
                "currentSlideIndex",
                clamped < 0 ? null : clamped,
              );
              rendererData.set("currentClickCount", clamped < 0 ? null : 0);
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
