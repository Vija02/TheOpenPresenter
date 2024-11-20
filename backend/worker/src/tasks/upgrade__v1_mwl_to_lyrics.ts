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
            if (
              plugin.plugin === "myworshiplist" ||
              plugin.plugin === "lyrics-presenter"
            ) {
              // 1. Migrate from old type
              if (!plugin.pluginData.songs) {
                plugin.pluginData.songs = [];

                try {
                  const pluginData = plugin.pluginData as any;

                  pluginData.songIds.map((songId: number) => {
                    const songCache = pluginData.songCache.find(
                      (cache: any) => cache.id === songId,
                    );

                    pluginData.songs.push({
                      id: songId,
                      cachedData: songCache,
                      setting: { displayType: "sections" },
                    });
                  });

                  delete pluginData.songIds;
                  delete pluginData.songCache;
                } catch (e) {
                  console.error("MWL: Failed to migrate to new data version");
                }
              }

              // 2. Migrate plugin type
              try {
                if (plugin.plugin === "myworshiplist") {
                  plugin.plugin = "lyrics-presenter";
                }
              } catch (e) {
                console.error("Failed to migrate to new data plugin name", e);
              }

              // 3. Migrate to new generalized format
              try {
                for (let i = 0; i < plugin.pluginData.songs.length; i++) {
                  const previousSong = plugin.pluginData.songs[i];
                  if (!!previousSong.cachedData) {
                    plugin.pluginData.songs[i] = {
                      id: typeidUnboxed(),
                      title: previousSong?.cachedData?.title,
                      content: previousSong?.cachedData?.content,
                      author: previousSong?.cachedData?.author,
                      album: null,
                      setting: previousSong.setting,
                      _imported: true,
                      import: {
                        type: "myworshiplist",
                        meta: { id: previousSong?.cachedData?.id },
                        importedData: previousSong?.cachedData,
                      },
                    };
                  }
                }
              } catch (e) {
                console.error(
                  "Lyrics: Failed to migrate to new data version",
                  e,
                );
              }
            }
          }
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
      }

      unbind();
    } catch (e) {
      console.error("Failed to migrate project id: " + project.id, e);
    }
  }
};

module.exports = task;
