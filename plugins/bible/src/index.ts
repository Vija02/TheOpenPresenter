import {
  ObjectToTypedMap,
  Plugin,
  PluginContext,
  ServerPluginApi,
  TRPCObject,
} from "@repo/base-plugin/server";
import { OrganizationType } from "@repo/graphql";
import { logger } from "@repo/observability";
import path from "path";
import * as Y from "yjs";
import z from "zod";

import { lookupPassage } from "./builtin/bibleApi";
import { defaultTranslationId } from "./builtin/translations";
import {
  pluginName,
  remoteWebComponentTag,
  rendererWebComponentTag,
} from "./consts";
import {
  registerLoadedPlugin,
  resolveContext,
  unregisterLoadedPlugin,
} from "./registry";
import { getPassageSlideCount } from "./helpers/slides";
import {
  createTranslation,
  deleteTranslation,
  listTranslations,
  resolveFromDb,
} from "./storage";
import { BiblePassage, PluginBaseData, PluginRendererData } from "./types";

export const init = (
  serverPluginApi: ServerPluginApi<PluginBaseData, PluginRendererData>,
) => {
  serverPluginApi.registerTrpcAppRouter(getAppRouter(serverPluginApi));

  serverPluginApi.registerMigrations(
    pluginName,
    path.join(__dirname, "../migrations"),
  );

  serverPluginApi.onPluginDataCreated(pluginName, onPluginDataCreated);
  serverPluginApi.onPluginDataLoaded(pluginName, onPluginDataLoaded);
  serverPluginApi.onRendererDataCreated(pluginName, onRendererDataCreated);

  serverPluginApi.registerSceneCreator(pluginName, {
    title: "Bible",
    description: "Display bible verses to the screen",
    categories: ["Display"],
    organizationTypeWhitelist: [OrganizationType.Church],
  });

  serverPluginApi.serveStatic(pluginName, "out");

  serverPluginApi.loadJsOnRemoteView(pluginName, `${pluginName}-remote.es.js`);
  serverPluginApi.loadCssOnRemoteView(pluginName, `RemoteEntry.css`);
  serverPluginApi.registerRemoteViewWebComponent(
    pluginName,
    remoteWebComponentTag,
  );

  serverPluginApi.loadJsOnRendererView(
    pluginName,
    `${pluginName}-renderer.es.js`,
  );
  serverPluginApi.loadCssOnRendererView(pluginName, `RendererEntry.css`);
  serverPluginApi.registerRendererViewWebComponent(
    pluginName,
    rendererWebComponentTag,
  );

  serverPluginApi.registerKeyPressHandler(
    pluginName,
    (keyType, { document, pluginData, rendererData }) => {
      const passages: BiblePassage[] =
        pluginData.get("passages")?.toJSON() ?? [];
      if (passages.length === 0) return;

      const passageIds = passages.map((x) => x.id);
      const currentPassageId = rendererData.get("passageId");
      const currentSlideIndex = rendererData.get("slideIndex");

      // Nothing selected yet -> select the very first slide.
      if (currentSlideIndex === null || currentSlideIndex === undefined) {
        document.transact(() => {
          rendererData.set("passageId", passageIds[0]!);
          rendererData.set("slideIndex", 0);
        });
        return;
      }

      const currentPassageIdx = passageIds.findIndex(
        (x) => x === currentPassageId,
      );
      const currentPassage = passages[currentPassageIdx];
      const currentMaxIndex = currentPassage
        ? getPassageSlideCount(currentPassage)
        : 0;

      if (keyType === "NEXT") {
        const newIndex = currentSlideIndex + 1;
        if (newIndex >= currentMaxIndex) {
          // Move to the first slide of the next passage, if any.
          const nextPassageId = passageIds[currentPassageIdx + 1];
          if (nextPassageId) {
            document.transact(() => {
              rendererData.set("passageId", nextPassageId);
              rendererData.set("slideIndex", 0);
            });
          }
        } else {
          rendererData.set("slideIndex", newIndex);
        }
      } else {
        const newIndex = currentSlideIndex - 1;
        if (newIndex < 0) {
          // Move to the last slide of the previous passage, if any.
          const prevPassageId = passageIds[currentPassageIdx - 1];
          if (prevPassageId) {
            const prevPassage = passages[currentPassageIdx - 1];
            const prevMaxIndex = prevPassage
              ? getPassageSlideCount(prevPassage)
              : 1;
            document.transact(() => {
              rendererData.set("passageId", prevPassageId);
              rendererData.set("slideIndex", Math.max(0, prevMaxIndex - 1));
            });
          }
        } else {
          rendererData.set("slideIndex", newIndex);
        }
      }
    },
  );
};

const onPluginDataCreated = (pluginInfo: ObjectToTypedMap<Plugin>) => {
  pluginInfo.get("pluginData")?.set("passages", new Y.Array());

  return {};
};

const onPluginDataLoaded = (
  _pluginInfo: ObjectToTypedMap<Plugin>,
  context: PluginContext,
) => {
  registerLoadedPlugin(context);
  return {
    dispose: () => {
      unregisterLoadedPlugin(context.pluginId);
    },
  };
};

const onRendererDataCreated = (
  rendererData: ObjectToTypedMap<Partial<PluginRendererData>>,
) => {
  rendererData.set("passageId", null);
  rendererData.set("slideIndex", null);

  return {};
};

const bookMetaSchema = z.object({
  n: z.number(),
  name: z.string(),
  abbr: z.array(z.string()),
  chapters: z.array(z.number()),
});

const chapterSchema = z.object({
  book: z.string(),
  bookNumber: z.number(),
  chapter: z.number(),
  verses: z.array(z.object({ v: z.number(), t: z.string() })),
});

const getAppRouter =
  (serverPluginApi: ServerPluginApi<PluginBaseData, PluginRendererData>) =>
  (t: TRPCObject) => {
    const authOf = (ctx: {
      sessionId: string | null;
      screenGuestSessionId: string | null;
    }) => ({
      sessionId: ctx.sessionId,
      screenGuestSessionId: ctx.screenGuestSessionId,
    });

    return t.router({
      bible: {
        // Built-in translations: resolved via bible-api by reference
        lookup: t.procedure
          .input(
            z.object({
              reference: z.string().min(1),
              translation: z.string().optional(),
            }),
          )
          .query(async ({ input }) => {
            try {
              return await lookupPassage(
                input.reference,
                input.translation ?? defaultTranslationId,
              );
            } catch (err) {
              logger.error(
                { err, input },
                "/bible.lookup: failed to resolve passage",
              );
              throw err;
            }
          }),

        // Uploaded translations
        translations: {
          list: t.procedure
            .input(z.object({ pluginId: z.string() }))
            .query(async ({ input, ctx }) => {
              const { organizationId } = resolveContext(input.pluginId);
              return listTranslations(
                serverPluginApi,
                authOf(ctx),
                organizationId,
              );
            }),

          create: t.procedure
            .input(
              z.object({
                pluginId: z.string(),
                name: z.string().min(1),
                abbreviation: z.string().nullish(),
                language: z.string().default("en"),
                format: z.string().default("manual"),
                books: z.array(bookMetaSchema),
                chapters: z.array(chapterSchema),
              }),
            )
            .mutation(async ({ input, ctx }) => {
              const { organizationId } = resolveContext(input.pluginId);
              const id = await createTranslation(serverPluginApi, authOf(ctx), {
                organizationId,
                userId: ctx.userId,
                name: input.name,
                abbreviation: input.abbreviation ?? null,
                language: input.language,
                format: input.format,
                books: input.books,
                chapters: input.chapters,
              });
              return { id };
            }),

          remove: t.procedure
            .input(z.object({ pluginId: z.string(), id: z.string() }))
            .mutation(async ({ input, ctx }) => {
              const { organizationId } = resolveContext(input.pluginId);
              await deleteTranslation(
                serverPluginApi,
                authOf(ctx),
                organizationId,
                input.id,
              );
              return { success: true };
            }),
        },

        // Resolve a reference against an uploaded translation
        resolveCustom: t.procedure
          .input(
            z.object({
              pluginId: z.string(),
              translationId: z.string(),
              bookName: z.string(),
              bookNumber: z.number(),
              chapter: z.number(),
              verseStart: z.number().optional(),
              verseEnd: z.number().optional(),
            }),
          )
          .query(async ({ input, ctx }) => {
            const { organizationId } = resolveContext(input.pluginId);
            try {
              return await resolveFromDb(serverPluginApi, authOf(ctx), {
                organizationId,
                translationId: input.translationId,
                bookName: input.bookName,
                bookNumber: input.bookNumber,
                chapter: input.chapter,
                verseStart: input.verseStart,
                verseEnd: input.verseEnd,
              });
            } catch (err) {
              logger.error(
                { err, input },
                "/bible.resolveCustom: failed to resolve passage",
              );
              throw err;
            }
          }),
      },
    });
  };

export type AppRouter = ReturnType<ReturnType<typeof getAppRouter>>;

export * from "./types";
export * from "./style/style";
export * from "./builtin/translations";
export * from "./builtin/bibleApi";
