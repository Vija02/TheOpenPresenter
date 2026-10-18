import { PluginContext, ServerPluginApi } from "@repo/base-plugin/server";
import z from "zod";

import { pluginName } from "./consts";
import { SavedPlaylist, Track } from "./types";

export type RequestAuth = {
  sessionId: string | null;
  screenGuestSessionId: string | null;
};

const loadedContext: Record<string, PluginContext> = {};

export const registerLoadedPlugin = (context: PluginContext) => {
  loadedContext[context.pluginId] = context;
};

export const unregisterLoadedPlugin = (pluginId: string) => {
  delete loadedContext[pluginId];
};

export const resolveOrganizationId = (pluginId: string) => {
  const context = loadedContext[pluginId];
  if (!context) {
    throw new Error(
      `Plugin instance ${pluginId} is not loaded; cannot resolve organization.`,
    );
  }
  return context.organizationId;
};

const metadataSchema = z.looseObject({
  title: z.string().optional(),
  author: z.string().optional(),
  duration: z.number().optional(),
  thumbnailUrl: z.string().optional(),
});

export const trackSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("youtube"),
    url: z.string(),
    metadata: metadataSchema,
  }),
  z.object({
    id: z.string(),
    type: z.literal("audio"),
    mediaName: z.string(),
    playbackMediaName: z.string().nullable(),
    coverMediaName: z.string().nullable(),
    metadata: metadataSchema,
  }),
]);

const columns = `id,
            name,
            tracks,
            created_at as "createdAt",
            updated_at as "updatedAt"`;

export const listSavedPlaylists = async (
  api: ServerPluginApi,
  auth: RequestAuth,
  organizationId: string,
): Promise<SavedPlaylist[]> => {
  const db = api.getPluginDb(pluginName, auth);
  const { rows } = await db.query<SavedPlaylist>(
    `select ${columns}
       from saved_playlist
      where organization_id = $1
      order by updated_at desc
      limit 500`,
    [organizationId],
  );
  return rows;
};

export const insertSavedPlaylist = async (
  api: ServerPluginApi,
  auth: RequestAuth,
  {
    organizationId,
    userId,
    name,
    tracks,
  }: {
    organizationId: string;
    userId: string | null;
    name: string;
    tracks: Track[];
  },
): Promise<SavedPlaylist> => {
  const db = api.getPluginDb(pluginName, auth);
  const {
    rows: [row],
  } = await db.query<SavedPlaylist>(
    `insert into saved_playlist
       (organization_id, created_by_user_id, name, tracks)
     values ($1, $2, $3, $4::jsonb)
     returning ${columns}`,
    [organizationId, userId, name, JSON.stringify(tracks)],
  );
  return row!;
};

export const updateSavedPlaylist = async (
  api: ServerPluginApi,
  auth: RequestAuth,
  organizationId: string,
  id: string,
  { name, tracks }: { name?: string; tracks?: Track[] },
): Promise<SavedPlaylist | null> => {
  const db = api.getPluginDb(pluginName, auth);
  const {
    rows: [row],
  } = await db.query<SavedPlaylist>(
    `update saved_playlist set
       name   = coalesce($3, name),
       tracks = coalesce($4::jsonb, tracks)
     where id = $1 and organization_id = $2
     returning ${columns}`,
    [id, organizationId, name ?? null, tracks ? JSON.stringify(tracks) : null],
  );
  return row ?? null;
};

export const deleteSavedPlaylist = async (
  api: ServerPluginApi,
  auth: RequestAuth,
  organizationId: string,
  id: string,
): Promise<void> => {
  const db = api.getPluginDb(pluginName, auth);
  await db.query(
    `delete from saved_playlist where id = $1 and organization_id = $2`,
    [id, organizationId],
  );
};
