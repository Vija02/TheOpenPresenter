import { InternalVideo } from "@repo/video";

import { pluginName } from "../consts";
import { SavedSong, Song } from "../types";
import { Api, RequestAuth, SavedSongEntry } from "./types";

// Get key we can rely on from the Song object
const deriveSavedSongKey = (
  song: Song,
): { source: string; externalId: string | null } => {
  const imp = song.import;
  if (imp?.type === "myworshiplist" && imp.meta?.id != null) {
    return { source: "myworshiplist", externalId: String(imp.meta.id) };
  }
  const normalizedTitle = (song.title ?? "").trim().toLowerCase();
  return {
    source: "manual",
    externalId: normalizedTitle ? `manual:${normalizedTitle}` : null,
  };
};

export const listSavedSongs = async (
  api: Api,
  auth: RequestAuth,
  organizationId: string,
): Promise<SavedSong[]> => {
  const db = api.getPluginDb(pluginName, auth);
  const { rows } = await db.query(
    `select id,
            title,
            author,
            album,
            source,
            external_id       as "externalId",
            song,
            video_backgrounds as "videoBackgrounds",
            created_at        as "createdAt",
            updated_at        as "updatedAt"
       from saved_song
      where organization_id = $1
      order by updated_at desc
      limit 500`,
    [organizationId],
  );
  return rows as SavedSong[];
};

export const insertSavedSong = async (
  api: Api,
  auth: RequestAuth,
  {
    organizationId,
    userId,
    song,
    videoBackgrounds,
  }: {
    organizationId: string;
    userId: string | null;
    song: Song;
    videoBackgrounds: InternalVideo[];
  },
): Promise<string> => {
  const { source, externalId } = deriveSavedSongKey(song);
  const db = api.getPluginDb(pluginName, auth);
  const {
    rows: [row],
  } = await db.query<{ id: string }>(
    `insert into saved_song
       (organization_id, created_by_user_id, title, author, album,
        content, source, external_id, song, video_backgrounds)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
     returning id`,
    [
      organizationId,
      userId,
      song.title ?? "",
      song.author ?? null,
      song.album ?? null,
      song.content ?? "",
      source,
      externalId,
      JSON.stringify(song),
      JSON.stringify(videoBackgrounds ?? []),
    ],
  );
  return row!.id;
};

export const updateSavedSong = async (
  api: Api,
  auth: RequestAuth,
  songbookId: string,
  organizationId: string,
  { song, videoBackgrounds }: { song: Song; videoBackgrounds: InternalVideo[] },
): Promise<void> => {
  const db = api.getPluginDb(pluginName, auth);
  await db.query(
    `update saved_song set
       title             = $1,
       author            = $2,
       album             = $3,
       content           = $4,
       song              = $5::jsonb,
       video_backgrounds = $6::jsonb,
       updated_at        = now()
     where id = $7 and organization_id = $8`,
    [
      song.title ?? "",
      song.author ?? null,
      song.album ?? null,
      song.content ?? "",
      JSON.stringify(song),
      JSON.stringify(videoBackgrounds ?? []),
      songbookId,
      organizationId,
    ],
  );
};

export const deleteSavedSong = async (
  api: Api,
  auth: RequestAuth,
  organizationId: string,
  id: string,
): Promise<void> => {
  const db = api.getPluginDb(pluginName, auth);
  await db.query(
    `delete from saved_song where id = $1 and organization_id = $2`,
    [id, organizationId],
  );
};

export const fetchSavedSong = async (
  api: Api,
  id: string,
  organizationId: string,
): Promise<SavedSongEntry | null> => {
  const db = api.getDangerousRootPluginDb(pluginName);
  const {
    rows: [row],
  } = await db.query<SavedSongEntry>(
    `select song, video_backgrounds as "videoBackgrounds"
       from saved_song
      where id = $1 and organization_id = $2`,
    [id, organizationId],
  );
  if (!row) return null;
  return { song: row.song, videoBackgrounds: row.videoBackgrounds ?? [] };
};

export const fetchSavedSongsByIds = async (
  api: Api,
  organizationId: string,
  ids: string[],
): Promise<Map<string, SavedSongEntry>> => {
  const db = api.getDangerousRootPluginDb(pluginName);
  const { rows } = await db.query<{ id: string } & SavedSongEntry>(
    `select id,
            song,
            video_backgrounds as "videoBackgrounds"
       from saved_song
      where organization_id = $1
        and id = any($2::uuid[])`,
    [organizationId, ids],
  );
  const byId = new Map<string, SavedSongEntry>();
  for (const row of rows) {
    byId.set(row.id, {
      song: row.song,
      videoBackgrounds: row.videoBackgrounds ?? [],
    });
  }
  return byId;
};

// ---------------------------------------------------------------------------
// Recently-used songs
// ---------------------------------------------------------------------------

export const recordRecentSong = async (
  api: Api,
  auth: RequestAuth,
  organizationId: string,
  savedSongId: string,
): Promise<void> => {
  const db = api.getPluginDb(pluginName, auth);
  await db.query(
    `insert into recent_song (organization_id, saved_song_id)
     values ($1, $2)`,
    [organizationId, savedSongId],
  );
};

export const listRecentSongs = async (
  api: Api,
  auth: RequestAuth,
  organizationId: string,
  limit = 8,
): Promise<Array<SavedSong & { usedAt: string }>> => {
  const db = api.getPluginDb(pluginName, auth);
  const { rows } = await db.query(
    `select ss.id,
            ss.title,
            ss.author,
            ss.album,
            ss.source,
            ss.external_id       as "externalId",
            ss.song,
            ss.video_backgrounds as "videoBackgrounds",
            ss.created_at        as "createdAt",
            ss.updated_at        as "updatedAt",
            latest.created_at    as "usedAt"
       from (
         select distinct on (rs.saved_song_id)
                rs.saved_song_id,
                rs.created_at
           from recent_song rs
          where rs.organization_id = $1
            and rs.saved_song_id is not null
          order by rs.saved_song_id, rs.created_at desc
       ) latest
       join saved_song ss on ss.id = latest.saved_song_id
      where ss.organization_id = $1
      order by latest.created_at desc
      limit $2`,
    [organizationId, limit],
  );
  return rows as Array<SavedSong & { usedAt: string }>;
};
