import {
  MediaMetadata,
  metadataWithin,
  readMediaMetadata,
  writeMediaMetadata,
} from "./metadata";

/**
 * The cloud's side of media sync. `client` is the caller's own connection, so
 * RLS decides what they can see; `root` writes what the visitor role has no
 * grants for (media metadata, deleting media), and only ever for media and
 * projects `client` has shown to be in the caller's organization.
 *
 * The files themselves go through the existing endpoints: `/media/data` down,
 * and tus at `/media/upload/tus` up.
 */

type Queryable = {
  query(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, any>[] }>;
};

export type CloudMedia = {
  id: string;
  mediaName: string;
  fileSize: string | null;
  originalName: string | null;
  fileExtension: string | null;
  isUserUploaded: boolean;
};

/** A media's use in a project, by the cloud's project id. */
export type MediaLink = {
  projectId: string;
  mediaId: string;
  pluginId: string;
};

export type CloudMediaPage = {
  /** The cloud's own id for the organization, which uploads need. */
  organizationId: string;
  media: CloudMedia[];
  metadata: MediaMetadata;
  links: MediaLink[];
  /** Pass as `after` for the next page; null on the last. */
  endCursor: string | null;
};

export const MEDIA_PAGE_SIZE = 500;

/** One page of the organization's complete media, in id order. */
export const listCloudMediaPage = async (
  client: Queryable,
  organizationId: string,
  after: string | null,
  first = MEDIA_PAGE_SIZE,
): Promise<CloudMediaPage> => {
  const { rows: media } = await client.query(
    `
      select m.id, m.media_name as "mediaName", m.file_size::text as "fileSize",
        m.original_name as "originalName", m.file_extension as "fileExtension",
        m.is_user_uploaded as "isUserUploaded"
      from app_public.medias m
      where m.organization_id = $1 and m.is_complete
        and ($2::uuid is null or m.id > $2::uuid)
      order by m.id
      limit $3
    `,
    [organizationId, after, first],
  );
  const ids = media.map((m) => m.id as string);
  const { rows: links } = await client.query(
    `
      select project_id as "projectId", media_id as "mediaId",
        plugin_id as "pluginId"
      from app_public.project_medias
      where media_id = any($1::uuid[])
    `,
    [ids],
  );
  return {
    organizationId,
    media: media as CloudMedia[],
    metadata: await readMediaMetadata(client, ids),
    links: links as MediaLink[],
    endCursor: media.length === first ? ids[ids.length - 1]! : null,
  };
};

/** Which of `mediaIds` are complete media in the organization. */
const mediaInOrganization = async (
  client: Queryable,
  organizationId: string,
  mediaIds: string[],
): Promise<Set<string>> => {
  const { rows } = await client.query(
    `select id from app_public.medias
     where organization_id = $1 and is_complete and id = any($2::uuid[])`,
    [organizationId, mediaIds],
  );
  return new Set(rows.map((r) => r.id));
};

/**
 * Add the metadata of media pushed here. Rows naming media the caller cannot
 * see in this organization are dropped, so nothing can be attached to
 * another organization's media.
 */
export const applyPushedMediaMetadata = async (
  client: Queryable,
  root: Queryable,
  organizationId: string,
  metadata: MediaMetadata,
): Promise<{ written: number; dropped: number }> => {
  const all = Object.values(metadata).flat().length;
  const ids = [
    ...new Set(
      [
        ...metadata.dependencies.flatMap((r) => [
          r.parentMediaId,
          r.childMediaId,
        ]),
        ...metadata.imageSizes.flatMap((r) => [
          r.imageMediaId,
          r.processedMediaId,
        ]),
        ...metadata.imageMetadata.map((r) => r.imageMediaId),
        ...metadata.videoMetadata.flatMap((r) => [
          r.videoMediaId,
          r.hlsMediaId,
          r.thumbnailMediaId,
          r.mp4MediaId,
        ]),
        ...(metadata.audioMetadata ?? []).flatMap((r) => [
          r.audioMediaId,
          r.playbackMediaId,
          r.coverMediaId,
        ]),
      ].filter((id): id is string => !!id),
    ),
  ];
  const visible = await mediaInOrganization(client, organizationId, ids);
  const within = metadataWithin(metadata, visible);
  await writeMediaMetadata(root, within);
  const written = Object.values(within).flat().length;
  return { written, dropped: all - written };
};

export type LinkChange = MediaLink & { remove: boolean };

/**
 * Add or remove media links, as the caller: the visitor role may, for
 * projects they can access. Each change gets a savepoint, so one that is
 * refused rejects only itself. Must run inside a transaction.
 */
export const applyPushedLinks = async (
  client: Queryable,
  organizationId: string,
  changes: LinkChange[],
): Promise<("applied" | "rejected")[]> => {
  const results: ("applied" | "rejected")[] = [];
  for (const change of changes) {
    await client.query("savepoint cloud_media_link");
    try {
      if (change.remove) {
        await client.query(
          `delete from app_public.project_medias
           where project_id = $1 and media_id = $2 and plugin_id = $3`,
          [change.projectId, change.mediaId, change.pluginId],
        );
      } else {
        const {
          rows: [ok],
        } = await client.query(
          `select
             exists (select 1 from app_public.projects
                     where id = $1 and organization_id = $3) as project,
             exists (select 1 from app_public.medias
                     where id = $2 and organization_id = $3) as media`,
          [change.projectId, change.mediaId, organizationId],
        );
        if (!ok!.project || !ok!.media) throw new Error("not in organization");
        await client.query(
          `insert into app_public.project_medias (project_id, media_id, plugin_id)
           values ($1, $2, $3) on conflict do nothing`,
          [change.projectId, change.mediaId, change.pluginId],
        );
      }
      await client.query("release savepoint cloud_media_link");
      results.push("applied");
    } catch {
      await client.query("rollback to savepoint cloud_media_link");
      results.push("rejected");
    }
  }
  return results;
};

export type MediaDeleteResult = "deleted" | "missing" | "inUse";

/**
 * Media whose own links, or any of their derived media's, put them in use.
 * Deleting a media deletes everything derived from it, so one whose PDF
 * pages are in a project is in use even if the PDF itself is not.
 */
export const mediaInUse = async (
  client: Queryable,
  mediaIds: string[],
): Promise<Set<string>> => {
  const { rows } = await client.query(
    `
      with recursive tree (root, id) as (
        select id, id from app_public.medias where id = any($1::uuid[])
        union
        select tree.root, d.child_media_id
        from tree
        join app_public.media_dependencies d on d.parent_media_id = tree.id
      )
      select distinct tree.root as id
      from tree
      join app_public.project_medias pm on pm.media_id = tree.id
    `,
    [mediaIds],
  );
  return new Set(rows.map((r) => r.id));
};

/**
 * Delete media another instance deleted, unless something here uses them:
 * then the other instance gets them back on its next sync.
 */
export const deleteSyncedMedia = async (
  client: Queryable,
  root: Queryable,
  organizationId: string,
  mediaIds: string[],
  deleteMedia: (mediaName: string) => Promise<void>,
): Promise<MediaDeleteResult[]> => {
  const { rows } = await client.query(
    `select id, media_name from app_public.medias
     where organization_id = $1 and id = any($2::uuid[])`,
    [organizationId, mediaIds],
  );
  const names = new Map(rows.map((r) => [r.id, r.media_name as string]));
  // Root: links to projects the caller cannot see still count as use.
  const inUse = await mediaInUse(root, [...names.keys()]);
  const results: MediaDeleteResult[] = [];
  for (const id of mediaIds) {
    const name = names.get(id);
    if (!name) {
      results.push("missing");
    } else if (inUse.has(id)) {
      results.push("inUse");
    } else {
      await deleteMedia(name);
      results.push("deleted");
    }
  }
  return results;
};
