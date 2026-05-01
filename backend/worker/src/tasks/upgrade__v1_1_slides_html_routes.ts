import type { YState } from "@repo/base-plugin";
import { Task } from "graphile-worker";
import * as Y from "yjs";

const PLUGIN_NAME = "slides";

function rewriteHtml(html: string): string | null {
  if (!html) return null;

  let next = html;
  if (next.includes("google-slides")) {
    next = next.split("google-slides").join("slides");
  }
  if (next.includes("staticScripts")) {
    next = next.split("staticScripts").join("gslide/gscripts");
  }
  if (next.includes("staticProxy")) {
    next = next.split("staticProxy").join("gslide/userUploads");
  }

  return next === html ? null : next;
}

const task: Task = async (_, { withPgClient }) => {
  const { rows: projects } = await withPgClient((pgClient) =>
    pgClient.query(
      `
        select * from app_public.projects
      `,
      [],
    ),
  );

  for (const project of projects) {
    try {
      const document = project.document;
      const ydoc = new Y.Doc();

      Y.applyUpdate(ydoc, document);

      const state = ydoc?.getMap() as YState;
      const dataMap = state.get("data") as Y.Map<any> | undefined;

      if (!dataMap) {
        continue;
      }

      let mutated = false;

      ydoc.transact(() => {
        for (const sceneValue of dataMap.values()) {
          if (!(sceneValue instanceof Y.Map)) continue;
          if (sceneValue.get("type") !== "scene") continue;

          const children = sceneValue.get("children") as
            | Y.Map<any>
            | undefined;
          if (!children) continue;

          for (const pluginValue of children.values()) {
            if (!(pluginValue instanceof Y.Map)) continue;
            if (pluginValue.get("plugin") !== PLUGIN_NAME) continue;

            const pluginData = pluginValue.get("pluginData") as
              | Y.Map<any>
              | undefined;
            if (!pluginData) continue;

            const imports = pluginData.get("imports") as
              | Y.Map<any>
              | undefined;
            if (!imports) continue;

            for (const importEntry of imports.values()) {
              if (!(importEntry instanceof Y.Map)) continue;
              if (importEntry.get("type") !== "googleslides") continue;

              try {
                const html = importEntry.get("html");
                if (typeof html !== "string") continue;

                const rewritten = rewriteHtml(html);
                if (rewritten !== null) {
                  importEntry.set("html", rewritten);
                  mutated = true;
                }
              } catch (e) {
                console.error(
                  "Slides: Failed to rewrite html routes for an import",
                  e,
                );
              }
            }
          }
        }
      });

      if (!mutated) {
        continue;
      }

      // SAVE TO DB
      try {
        await withPgClient(async (pgClient) => {
          await pgClient.query("SET session_replication_role = replica;");
          await pgClient.query(
            "update app_public.projects set document = $1 where id = $2",
            [Buffer.from(Y.encodeStateAsUpdate(ydoc)), project.id],
          );
          return Promise.resolve();
        });
      } catch (e) {
        console.error("Failed to save the migrated data to the database", e);
      }
    } catch (e) {
      console.error("Failed to migrate project id: " + project.id, e);
    }
  }
};

module.exports = task;
