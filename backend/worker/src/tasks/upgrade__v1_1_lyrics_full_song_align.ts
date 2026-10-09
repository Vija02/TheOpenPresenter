import type { LayoutDoc } from "@repo/layout";
import { Task } from "graphile-worker";
import * as Y from "yjs";

import {
  FULL_SONG_LOOK,
  type LegacySong,
  repairFullSongTemplate,
} from "../migrations/lyricsLayoutUpgrade";
import { lyricsScenes, toYjs } from "../migrations/lyricsYjs";

/** `pluginSchemaName("lyrics-presenter")` */
const SCHEMA = "plugin_lyrics_presenter";
const SONGBOOK_TABLE = `${SCHEMA}.saved_song`;
const LOOK_TABLE = `${SCHEMA}.look`;

/**
 * `upgrade__v1_lyrics_layout` gave the full song look the main look's
 * centred template, where the old full song view was left and top aligned.
 * Puts the full song templates it made back, on the organizations' looks,
 * the songs in scenes and the songbook
 */
const task: Task = async (_, { withPgClient }) => {
  // Looks. Triggers fire, so open scenes pick them up
  try {
    await withPgClient(async (pgClient) => {
      await pgClient.query("SET session_replication_role = origin;");
      const { rows } = await pgClient.query(
        `select id, template from ${LOOK_TABLE} where key = $1`,
        [FULL_SONG_LOOK],
      );
      for (const row of rows) {
        const template = repairFullSongTemplate(row.template as LayoutDoc);
        if (!template) continue;
        await pgClient.query(
          `update ${LOOK_TABLE} set template = $1::jsonb where id = $2`,
          [JSON.stringify(template), row.id],
        );
      }
    });
  } catch (e) {
    console.error("Failed to repair the organizations' full song looks", e);
  }

  // Songs in scenes
  const { rows: projects } = await withPgClient((pgClient) =>
    pgClient.query(`select id, document from app_public.projects`),
  );

  for (const project of projects) {
    try {
      const ydoc = new Y.Doc();
      Y.applyUpdate(ydoc, project.document);

      let mutated = false;

      ydoc.transact(() => {
        for (const { pluginData } of lyricsScenes(ydoc)) {
          const songs = pluginData.get("songs");
          if (!(songs instanceof Y.Array)) continue;

          for (const song of songs) {
            if (!(song instanceof Y.Map)) continue;
            const looks = song.get("looks");
            if (!(looks instanceof Y.Map)) continue;
            const look = looks.get(FULL_SONG_LOOK);
            if (!(look instanceof Y.Map)) continue;
            const template = look.get("template");
            if (!(template instanceof Y.Map)) continue;

            const repaired = repairFullSongTemplate(
              template.toJSON() as LayoutDoc,
            );
            if (!repaired) continue;
            look.set("template", toYjs(repaired));
            mutated = true;
          }
        }
      });

      if (!mutated) continue;

      await withPgClient(async (pgClient) => {
        await pgClient.query("SET session_replication_role = replica;");
        await pgClient.query(
          "update app_public.projects set document = $1 where id = $2",
          [Buffer.from(Y.encodeStateAsUpdate(ydoc)), project.id],
        );
      });
    } catch (e) {
      console.error("Failed to repair project id: " + project.id, e);
    }
  }

  // Songbook rows
  try {
    await withPgClient(async (pgClient) => {
      const { rows } = await pgClient.query(
        `select id, song from ${SONGBOOK_TABLE}
          where song -> 'looks' -> $1 -> 'template' is not null
            and jsonb_typeof(song -> 'looks' -> $1 -> 'template') = 'object'`,
        [FULL_SONG_LOOK],
      );

      await pgClient.query("SET session_replication_role = replica;");
      for (const row of rows) {
        try {
          const song = row.song as LegacySong;
          const look = song.looks![FULL_SONG_LOOK]!;
          const template = repairFullSongTemplate(look.template!);
          if (!template) continue;
          await pgClient.query(
            `update ${SONGBOOK_TABLE} set song = $1 where id = $2`,
            [
              JSON.stringify({
                ...song,
                looks: {
                  ...song.looks,
                  [FULL_SONG_LOOK]: { ...look, template },
                },
              }),
              row.id,
            ],
          );
        } catch (e) {
          console.error("Failed to repair saved song id: " + row.id, e);
        }
      }
    });
  } catch (e) {
    console.error("Failed to repair the songbook", e);
  }
};

module.exports = task;
