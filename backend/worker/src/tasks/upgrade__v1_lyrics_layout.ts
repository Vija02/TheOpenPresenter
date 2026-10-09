import { Task } from "graphile-worker";
import * as Y from "yjs";

import {
  LEGACY_STYLE_LOOKS,
  type LookLayout,
  convertSavedSong,
  convertSceneSongs,
  convertSceneStyle,
  type LegacySong,
  lookTemplateFor,
} from "../migrations/lyricsLayoutUpgrade";
import { lyricsScenes, toYjs } from "../migrations/lyricsYjs";

/** `pluginSchemaName("lyrics-presenter")` */
const SCHEMA = "plugin_lyrics_presenter";
const SONGBOOK_TABLE = `${SCHEMA}.saved_song`;
const LOOK_TABLE = `${SCHEMA}.look`;

/**
 * Lyrics moved onto `@repo/layout`, with looks that are the organization's.
 * Each organization's most recently edited styled scene becomes its looks.
 * Songs in scenes styled otherwise keep their scene's look as their own, so
 * nothing changes on screen. Songbook songs convert too. The old fields are
 * left in place, unread
 */
const task: Task = async (_, { withPgClient }) => {
  // The plugin's tables come from its own migrations, which the server runs
  // on start. Until then, fail, so the job is retried
  await withPgClient(async (pgClient) => {
    const {
      rows: [row],
    } = await pgClient.query(`select to_regclass($1) as exists`, [LOOK_TABLE]);
    if (!row?.exists) {
      throw new Error(`${LOOK_TABLE} doesn't exist yet, retrying later`);
    }
  });

  // An organization that edited its look before this ran keeps it
  const organizationLooks = new Map<string, LookLayout | null>();
  const { rows: existing } = await withPgClient((pgClient) =>
    pgClient.query(
      `select organization_id, template, background from ${LOOK_TABLE}
        where key = $1`,
      [LEGACY_STYLE_LOOKS[0].key],
    ),
  );
  for (const row of existing) {
    organizationLooks.set(row.organization_id, {
      template: row.template,
      background: row.background,
    });
  }

  // Most recent first: the first styled scene an organization has wins
  const { rows: projects } = await withPgClient((pgClient) =>
    pgClient.query(
      `select id, organization_id, document from app_public.projects
        order by updated_at desc`,
    ),
  );

  const decode = (project: { document: Buffer }) => {
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, project.document);
    return ydoc;
  };

  // First decide every organization's look, so each scene below is compared
  // against the final one
  for (const project of projects) {
    if (organizationLooks.has(project.organization_id)) continue;
    try {
      for (const { legacy } of lyricsScenes(decode(project))) {
        const look = convertSceneStyle(legacy);
        if (look) {
          organizationLooks.set(project.organization_id, look);
          break;
        }
      }
    } catch (e) {
      console.error("Failed to read project id: " + project.id, e);
    }
  }

  for (const project of projects) {
    try {
      const ydoc = decode(project);

      const scenes = lyricsScenes(ydoc);
      if (scenes.length === 0) continue;

      let mutated = false;

      ydoc.transact(() => {
        for (const { pluginData, legacy } of scenes) {
          const songs = pluginData.get("songs");
          if (!(songs instanceof Y.Array)) continue;

          const converted = convertSceneSongs(
            legacy,
            organizationLooks.get(project.organization_id) ?? null,
          );
          for (const [index, looks] of converted) {
            const songMap = songs.get(index);
            if (!(songMap instanceof Y.Map)) continue;
            songMap.set("looks", toYjs(looks));
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

  // The styles that became looks. Never over one the organization has
  try {
    await withPgClient(async (pgClient) => {
      // Fire the triggers, so open scenes pick the looks up
      await pgClient.query("SET session_replication_role = origin;");
      for (const [organizationId, look] of organizationLooks) {
        if (!look) continue;
        for (const { key, name, position } of LEGACY_STYLE_LOOKS) {
          await pgClient.query(
            `insert into ${LOOK_TABLE}
               (organization_id, key, name, position, template, background)
             values ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
             on conflict (organization_id, key) do nothing`,
            [
              organizationId,
              key,
              name,
              position,
              JSON.stringify(lookTemplateFor(key, look.template)),
              look.background === null ? null : JSON.stringify(look.background),
            ],
          );
        }
      }
    });
  } catch (e) {
    console.error("Failed to save the organizations' looks", e);
  }

  // Songbook rows
  try {
    await withPgClient(async (pgClient) => {
      const { rows } = await pgClient.query(
        `select id, song, video_backgrounds from ${SONGBOOK_TABLE}
          where not (song ? 'looks')`,
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
