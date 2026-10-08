import type { YState } from "@repo/base-plugin";
import { Task } from "graphile-worker";
import * as Y from "yjs";

import {
  type LegacyPluginData,
  type LegacySong,
  convertPluginData,
  convertSavedSong,
} from "../migrations/lyricsLayoutUpgrade";

const PLUGIN_NAME = "lyrics-presenter";
/** `pluginSchemaName("lyrics-presenter")` */
const SONGBOOK_TABLE = "plugin_lyrics_presenter.saved_song";

const toYjs = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    const array = new Y.Array();
    array.push(value.map(toYjs));
    return array;
  }
  if (value !== null && typeof value === "object") {
    const map = new Y.Map();
    for (const [key, entry] of Object.entries(value)) {
      if (entry !== undefined) map.set(key, toYjs(entry));
    }
    return map;
  }
  return value;
};

/**
 * Lyrics moved onto `@repo/layout`: each scene's old style becomes a text
 * template and a background, and each song's style override its own. Songbook
 * songs convert too. The old fields are left in place, unread
 */
const task: Task = async (_, { withPgClient }) => {
  const { rows: projects } = await withPgClient((pgClient) =>
    pgClient.query(`select * from app_public.projects`, []),
  );

  for (const project of projects) {
    try {
      const ydoc = new Y.Doc();
      Y.applyUpdate(ydoc, project.document);

      const state = ydoc.getMap() as YState;
      const dataMap = state.get("data") as Y.Map<any> | undefined;
      if (!dataMap) continue;

      let mutated = false;

      ydoc.transact(() => {
        for (const sceneValue of dataMap.values()) {
          if (!(sceneValue instanceof Y.Map)) continue;
          if (sceneValue.get("type") !== "scene") continue;

          const children = sceneValue.get("children") as Y.Map<any> | undefined;
          for (const pluginValue of children?.values() ?? []) {
            if (!(pluginValue instanceof Y.Map)) continue;
            if (pluginValue.get("plugin") !== PLUGIN_NAME) continue;

            const pluginData = pluginValue.get("pluginData");
            if (!(pluginData instanceof Y.Map)) continue;

            const conversion = convertPluginData(
              pluginData.toJSON() as LegacyPluginData,
            );
            if (!conversion) continue;

            if (conversion.scene) {
              pluginData.set("template", toYjs(conversion.scene.template));
              pluginData.set("background", toYjs(conversion.scene.background));
            }

            const songs = pluginData.get("songs");
            for (const [index, song] of conversion.songs) {
              const songMap =
                songs instanceof Y.Array ? songs.get(index) : null;
              if (!(songMap instanceof Y.Map)) continue;
              songMap.set("template", toYjs(song.template));
              songMap.set("background", toYjs(song.background));
            }

            mutated = true;
          }
        }
      });

      if (!mutated) continue;

      // SAVE TO DB
      try {
        await withPgClient(async (pgClient) => {
          await pgClient.query("SET session_replication_role = replica;");
          await pgClient.query(
            "update app_public.projects set document = $1 where id = $2",
            [Buffer.from(Y.encodeStateAsUpdate(ydoc)), project.id],
          );
        });
      } catch (e) {
        console.error("Failed to save the migrated data to the database", e);
      }
    } catch (e) {
      console.error("Failed to migrate project id: " + project.id, e);
    }
  }

  // Songbook rows, where the plugin's tables exist
  try {
    await withPgClient(async (pgClient) => {
      const {
        rows: [table],
      } = await pgClient.query(`select to_regclass($1) as exists`, [
        SONGBOOK_TABLE,
      ]);
      if (!table?.exists) return;

      const { rows } = await pgClient.query(
        `select id, song, video_backgrounds from ${SONGBOOK_TABLE}
          where not (song ? 'template')`,
      );

      await pgClient.query("SET session_replication_role = replica;");
      for (const row of rows) {
        try {
          const song = convertSavedSong(
            row.song as LegacySong,
            row.video_backgrounds ?? [],
          );
          if (!song) continue;
          await pgClient.query(
            `update ${SONGBOOK_TABLE} set song = $1 where id = $2`,
            [JSON.stringify(song), row.id],
          );
        } catch (e) {
          console.error("Failed to migrate saved song id: " + row.id, e);
        }
      }
    });
  } catch (e) {
    console.error("Failed to migrate the songbook", e);
  }
};

module.exports = task;
