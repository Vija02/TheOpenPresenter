import type { StateData, YState } from "@repo/base-plugin";
import { Task } from "graphile-worker";
import { typeidUnboxed } from "typeid-js";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";
import * as Y from "yjs";

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
      const dataMap = state.get("data");

      const data = proxy(dataMap!.toJSON() as StateData);
      const unbind = bind(data, dataMap as any);

      for (const scene of Object.values(data)) {
        if (scene.type === "scene") {
          for (const plugin of Object.values(scene.children)) {
            if (plugin.plugin === "simple-image") {
              try {
                const images = plugin.pluginData.images || [];
                const importId = typeidUnboxed();
                const slideOrder: string[] = [];
                const thumbnailLinks: string[] = [];
                const slideClickCounts: number[] = [];
                const slideIds: string[] = [];

                // map old images to slides arrays
                images.forEach((img: any, index: number) => {
                  slideOrder.push(`${importId}:${index}`);
                  thumbnailLinks.push(typeof img === "string" ? img : (img?.url || ""));
                  slideClickCounts.push(0);
                  slideIds.push(typeidUnboxed());
                });

                // build new slides import object
                plugin.pluginData.imports = images.length > 0 ? {
                  [importId]: {
                    importId,
                    name: "Imported Images",
                    fetchId: Date.now().toString(),
                    type: "image",
                    thumbnailLinks,
                    slideClickCounts,
                    slideIds,
                  }
                } : {};
                
                plugin.pluginData.slideOrder = slideOrder;
                delete plugin.pluginData.images;

                // fix renderer state so it doesnt crash on load
                const renderer = (plugin as any).rendererData;
                if (renderer) {
                  renderer.currentSlideIndex = renderer.imgIndex ?? null;
                  renderer.currentClickCount = null;
                  delete renderer.imgIndex;
                }

                plugin.plugin = "slides";

              } catch (e) {
                console.error("simple image: failed to migrate to slides format", e);
              }
            }
          }
        }
      }

      // save to db
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
        console.error("failed to save migrated simple-image data to database", e);
      }

      unbind();
    } catch (e) {
      console.error("failed to migrate project id: " + project.id, e);
    }
  }
};

module.exports = task;