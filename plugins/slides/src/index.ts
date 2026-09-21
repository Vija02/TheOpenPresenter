import {
  ObjectToTypedMap,
  Plugin,
  PluginContext,
  ServerPluginApi,
  TRPCObject,
} from "@repo/base-plugin/server";
import { VIDEO_VOLUME_KEY } from "@repo/base-types";
import { TypedMap } from "@repo/lib";
import { logger } from "@repo/observability";
import { createProxyMiddleware } from "http-proxy-middleware";
import path from "path";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";
import * as Y from "yjs";
import z from "zod";

import { dataBindings } from "./bindings";
import {
  pluginName,
  remoteWebComponentTag,
  rendererWebComponentTag,
} from "./consts";
import { isCustomImport, rebuildOrderAfterSlideRemoval } from "./customSlides";
import { derivationFields } from "./derivation";
import { createImporters } from "./importers";
import { getCanvaOAuthConfig } from "./importers/canva/oauth";
import { createCanvaRouter } from "./importers/canva/router";
import { registerCanvaRoutes } from "./importers/canva/routes";
import { createImportHelpers } from "./importers/helpers";
import { createRemoveImportById } from "./importers/removeImport";
import {
  loadedContext,
  loadedPlugins,
  loadedRendererDataGetter,
  loadedYjsData,
} from "./loadedState";
import { activateSlide, yjsActivationTarget } from "./slides/activation";
import {
  createSlideRef,
  getAutoplayDurationForSlide,
  getClickCountForSlide,
  getClickDurationForSlide,
  getTransitionDurationForSlide,
} from "./slides/order";
import {
  AutoplayState,
  CustomImportData,
  PluginBaseData,
  PluginRendererData,
} from "./types";
import {
  createLink,
  listLinksForPlugin,
  listUploadsForPlugin,
  revokeLink,
} from "./uploadLink/db";
import { buildUploadLinkDeps } from "./uploadLink/deps";
import {
  getUploadLinkBaseUrl,
  registerUploadLinkRoutes,
} from "./uploadLink/routes";

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

  registerUploadLinkRoutes(
    serverPluginApi,
    buildUploadLinkDeps(serverPluginApi),
  );

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
    icon: "presentation",
  });

  serverPluginApi.serveStatic(pluginName, "out");

  serverPluginApi.registerDerivationFields(pluginName, derivationFields);

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
  serverPluginApi.loadJsOnRendererView(
    pluginName,
    `${pluginName}-dataProvider.es.js`,
  );
  serverPluginApi.loadJsOnRemoteView(
    pluginName,
    `${pluginName}-dataProvider.es.js`,
  );
  serverPluginApi.registerDataBindings(pluginName, dataBindings);
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

      const activationTarget = yjsActivationTarget(rendererData);

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
            activateSlide(
              activationTarget,
              pluginDataJson,
              returningSlideIndex,
              { clickCount: returningHasAutoplay ? -1 : 0, now },
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
            activateSlide(activationTarget, pluginDataJson, nextSlideIndex, {
              now,
            });
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
            activateSlide(activationTarget, pluginDataJson, prevSlideIndex, {
              clickCount: maxClicksForPrevSlide,
              now,
            });

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
  rendererData.set(VIDEO_VOLUME_KEY, 1);

  const autoPlay = new Y.Map() as TypedMap<AutoplayState>;
  autoPlay.set("enabled", false);
  autoPlay.set("loopDurationMs", 10000);
  rendererData.set("autoplay", autoPlay as any);

  return {};
};

const getAppRouter = (serverPluginApi: ServerPluginApi) => (t: TRPCObject) => {
  const importHelpers = createImportHelpers(serverPluginApi);
  const { importPpt, importGoogleSlidesDeck, importPdf, importImages } =
    createImporters(serverPluginApi, importHelpers);
  const canvaRouter = createCanvaRouter(t, { serverPluginApi, importHelpers });
  const removeImportById = createRemoveImportById(serverPluginApi);

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
          }) =>
            importPpt({
              pluginId,
              mediaName,
              name,
              replaceImportId,
              userId: ctx.userId,
            }),
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
          }) =>
            importPdf({
              pluginId,
              mediaName,
              name,
              replaceImportId,
              userId: ctx.userId,
            }),
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
        .mutation(async ({ input: { pluginId, images, replaceImportId } }) =>
          importImages({ pluginId, images, replaceImportId }),
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
          }) =>
            importGoogleSlidesDeck({
              pluginId,
              presentationId,
              token,
              name,
              replaceImportId,
              userId: ctx.userId,
            }),
        ),

      ...canvaRouter.procedures,

      // Upload links stuff
      listUploadLinks: t.procedure
        .input(z.object({ pluginId: z.string() }))
        .query(async ({ input: { pluginId } }) => {
          const [links, uploads] = await Promise.all([
            listLinksForPlugin(serverPluginApi, pluginId),
            listUploadsForPlugin(serverPluginApi, pluginId),
          ]);
          return { links, uploads, baseUrl: getUploadLinkBaseUrl() };
        }),
      createUploadLink: t.procedure
        .input(
          z.object({
            pluginId: z.string(),
            label: z.string().optional(),
            maxAttempts: z.number().int().positive().optional(),
            expiresAt: z.string().optional(),
          }),
        )
        .mutation(
          async ({
            input: { pluginId, label, maxAttempts, expiresAt },
            ctx,
          }) => {
            const loadedContextData = loadedContext[pluginId]!;

            const link = await createLink(serverPluginApi, {
              organizationId: loadedContextData.organizationId,
              projectId: loadedContextData.projectId,
              sceneId: loadedContextData.sceneId,
              pluginId,
              label,
              maxAttempts,
              expiresAt,
              userId: ctx.userId,
            });

            return { link, baseUrl: getUploadLinkBaseUrl() };
          },
        ),
      revokeUploadLink: t.procedure
        .input(z.object({ pluginId: z.string(), id: z.string() }))
        .mutation(async ({ input: { pluginId, id } }) => {
          await revokeLink(serverPluginApi, { id, pluginId });
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
