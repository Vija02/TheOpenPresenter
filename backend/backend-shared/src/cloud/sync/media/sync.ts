import { logger } from "@repo/observability";
import { Client } from "urql";

import type { MediaHandlerInterface } from "../../../media/types";
import { WithPgClient } from "../../../types";
import { getUrqlClientFromCloudConnection } from "../../urqlClientFromCloudConnection";
import { inBatches, queryCloud } from "../cloudQuery";
import type {
  CloudMediaPage,
  LinkChange,
  MediaDeleteResult,
  MediaLink,
} from "./cloud";
import { mediaInUse } from "./cloud";
import {
  MediaMetadata,
  emptyMediaMetadata,
  metadataWithin,
  readMediaMetadata,
  writeMediaMetadata,
} from "./metadata";
import { LocalMedia, downloadMedia, uploadMedia } from "./transfer";

// Not codegen'd: these fields return JSON.
const CLOUD_MEDIA_SYNC_PAGE = `
  query CloudMediaSyncPage($organizationSlug: String!, $after: UUID) {
    cloudMediaSyncPage(organizationSlug: $organizationSlug, after: $after)
  }
`;
const CLOUD_MEDIA_SYNC_PUSH = `
  mutation CloudMediaSyncPush($organizationSlug: String!, $metadata: JSON!, $links: JSON!) {
    cloudMediaSyncPush(organizationSlug: $organizationSlug, metadata: $metadata, links: $links)
  }
`;
const CLOUD_MEDIA_SYNC_DELETE = `
  mutation CloudMediaSyncDelete($organizationSlug: String!, $mediaIds: JSON!) {
    cloudMediaSyncDelete(organizationSlug: $organizationSlug, mediaIds: $mediaIds)
  }
`;

const MEDIA = "app_public.medias";
const LINKS = "app_public.project_medias";
const TRANSFER_CONCURRENCY = 4;
const PUSH_BATCH = 500;

type CloudConnection = {
  id: string;
  host: string;
  session_cookie: string;
  organization_id: string;
  target_organization_slug: string;
  creator_user_id: string | null;
};

export type MediaSyncCounts = {
  pulled: number;
  pushed: number;
  transferFailed: number;
  deletedLocally: number;
  deletedOnCloud: number;
  /** Deleted on one side but used on the other, so restored instead. */
  keptInUse: number;
  linksAdded: number;
  linksRemoved: number;
};

type Hooks = {
  onTransfersPlanned?: (plan: { count: number; bytes: number }) => unknown;
  onBytes?: (bytes: number) => unknown;
  onTransferred?: () => unknown;
};

const linkKey = (l: MediaLink) => `${l.projectId}/${l.mediaId}/${l.pluginId}`;

/**
 * Two-way sync of an organization's media files, their metadata, and their
 * use in projects ("links"). Media keep the same id on both sides; links are
 * keyed by the cloud's project id.
 *
 * Media follow the app's own rules for each kind:
 *
 * - Plugin media (PDF pages, video renditions, resized images) exist while a
 *   project links to them, or while what they were derived from exists; each
 *   side's cleanup deletes them once neither holds. So sync tracks no state
 *   for them and never deletes them: it syncs the links, and copies a plugin
 *   media to the other side when a link there, or what it was derived from,
 *   needs it there.
 * - User uploads live in the library until someone deletes them, so they
 *   have state, and a delete on one side is a delete on the other, unless
 *   the other side uses it (or anything derived from it): then it is copied
 *   back, along with what was derived from it and their links.
 *
 * Links only sync for `projectIds`, projects on both sides after project
 * sync: a project deleted on one side takes its links with it, which is not
 * their removal.
 */
export const syncMedia = async (
  withPgClient: WithPgClient,
  cloudConnection: CloudConnection,
  {
    mediaHandler,
    projectIds,
    ...hooks
  }: Hooks & { mediaHandler: MediaHandlerInterface; projectIds: string[] },
): Promise<MediaSyncCounts> => {
  const urqlClient = getUrqlClientFromCloudConnection(cloudConnection);
  const organizationSlug = cloudConnection.target_organization_slug;
  const counts: MediaSyncCounts = {
    pulled: 0,
    pushed: 0,
    transferFailed: 0,
    deletedLocally: 0,
    deletedOnCloud: 0,
    keptInUse: 0,
    linksAdded: 0,
    linksRemoved: 0,
  };

  const cloud = await listCloud(urqlClient, organizationSlug);
  const cloudMedia = new Map(cloud.media.map((m) => [m.id, m]));
  const local = await listLocal(withPgClient, cloudConnection);
  const cloudChildren = childrenMap(cloud.metadata.dependencies);
  const syncedProjects = new Set(projectIds);
  const links = await compareLinks(
    withPgClient,
    cloudConnection,
    cloud.links.filter((l) => syncedProjects.has(l.projectId)),
    syncedProjects,
  );

  // ---- User uploads deleted on one side ----
  const synced = await syncedUploads(withPgClient, cloudConnection.id);
  const deletedOnCloud = [...synced].filter(
    (id) => local.media.has(id) && !cloudMedia.has(id),
  );
  const deletedHere = [...synced].filter(
    (id) => cloudMedia.has(id) && !local.media.has(id),
  );
  const usedHere = await withPgClient((pgClient) =>
    mediaInUse(pgClient, deletedOnCloud),
  );
  const usedOnCloud = cloudMediaInUse(cloud, new Set(cloud.links.map(linkKey)));
  const restoreToCloud = deletedOnCloud.filter((id) => usedHere.has(id));
  const restoreHere = deletedHere.filter((id) => usedOnCloud.has(id));
  const deleteHere = deletedOnCloud.filter((id) => !usedHere.has(id));
  const deleteOnCloud = deletedHere.filter((id) => !usedOnCloud.has(id));
  counts.keptInUse = restoreToCloud.length + restoreHere.length;

  // What was derived from a restored upload went with it on the side that
  // deleted it, links and all. Its link state would read as the links
  // having been removed there; without it, they are added back.
  const restoredTrees = new Set([
    ...withDerived(restoreToCloud, local.children),
    ...withDerived(restoreHere, cloudChildren),
  ]);
  for (const link of links) {
    if (restoredTrees.has(link.link.mediaId)) link.has_state = false;
  }

  for (const id of deleteHere) {
    // Checked again now: it may have been put to use since.
    const stillUsed = await withPgClient((pgClient) =>
      mediaInUse(pgClient, [id]),
    );
    if (stillUsed.size > 0) continue;
    await mediaHandler.deleteMedia(local.media.get(id)!.media_name);
    counts.deletedLocally += 1;
  }
  for (const batch of inBatches(deleteOnCloud, PUSH_BATCH)) {
    const { cloudMediaSyncDelete } = await queryCloud<{
      cloudMediaSyncDelete: MediaDeleteResult[];
    }>(
      urqlClient,
      CLOUD_MEDIA_SYNC_DELETE,
      { organizationSlug, mediaIds: batch },
      "mutation",
    );
    counts.deletedOnCloud += cloudMediaSyncDelete.filter(
      (r) => r === "deleted",
    ).length;
  }
  // Forgotten whatever the cloud answered: "inUse" means it uses it after
  // all, and without state it is copied back next sync. Restored ones keep
  // their state until copied, so a failed copy is retried the same way.
  await forgetState(
    withPgClient,
    cloudConnection.id,
    MEDIA,
    [
      ...deleteHere,
      ...deleteOnCloud,
      ...[...synced].filter(
        (id) => !local.media.has(id) && !cloudMedia.has(id),
      ),
    ].map((id) => ({ id })),
  );

  // ---- Link removals ----
  const removedHere = links.filter(
    (l) => l.has_state && !l.in_local && l.in_cloud,
  );
  const removedOnCloud = links.filter(
    (l) => l.has_state && l.in_local && !l.in_cloud,
  );
  if (removedHere.length > 0) {
    await pushLinks(
      urqlClient,
      organizationSlug,
      removedHere.map((l) => ({ ...l.link, remove: true })),
    );
  }
  if (removedOnCloud.length > 0) {
    // Each side's cleanup deletes plugin media no longer linked anywhere.
    await withPgClient((pgClient) =>
      pgClient.query(
        `delete from app_public.project_medias pm
         using jsonb_to_recordset($1::jsonb)
           as x("localProjectId" uuid, "mediaId" uuid, "pluginId" uuid)
         where pm.project_id = x."localProjectId"
           and pm.media_id = x."mediaId" and pm.plugin_id = x."pluginId"`,
        [JSON.stringify(removedOnCloud.map((l) => l.local))],
      ),
    );
  }
  counts.linksRemoved = removedHere.length + removedOnCloud.length;
  await forgetState(
    withPgClient,
    cloudConnection.id,
    LINKS,
    [
      ...removedHere,
      ...removedOnCloud,
      ...links.filter((l) => l.has_state && !l.in_local && !l.in_cloud),
    ].map((l) => l.link),
  );

  // ---- What each side needs ----
  const addOnCloud = links.filter(
    (l) => !l.has_state && l.in_local && !l.in_cloud,
  );
  const addHere = links.filter(
    (l) => !l.has_state && l.in_cloud && !l.in_local && l.local.localProjectId,
  );
  const deleting = new Set([...deleteHere, ...deleteOnCloud]);
  const toPush = needed({
    uploads: [
      ...[...local.media.keys()].filter(
        (id) =>
          local.media.get(id)!.is_user_uploaded &&
          !cloudMedia.has(id) &&
          !synced.has(id),
      ),
      ...restoreToCloud,
    ],
    linked: addOnCloud.map((l) => l.link.mediaId),
    there: [...cloudMedia.keys()].filter((id) => !deleting.has(id)),
    here: local.media,
    children: local.children,
    isUpload: (id) => local.media.get(id)!.is_user_uploaded,
  }).map((id) => local.media.get(id)!);
  const toPull = needed({
    uploads: [
      ...[...cloudMedia.values()]
        .filter(
          (m) =>
            m.isUserUploaded && !local.media.has(m.id) && !synced.has(m.id),
        )
        .map((m) => m.id),
      ...restoreHere,
    ],
    linked: addHere.map((l) => l.link.mediaId),
    there: [...local.media.keys()].filter((id) => !deleting.has(id)),
    here: cloudMedia,
    children: cloudChildren,
    isUpload: (id) => cloudMedia.get(id)!.isUserUploaded,
  }).map((id) => cloudMedia.get(id)!);

  // ---- Files ----
  await hooks.onTransfersPlanned?.({
    count: toPull.length + toPush.length,
    bytes: [...toPull.map((m) => m.fileSize), ...toPush.map((m) => m.file_size)]
      .map((s) => Number(s ?? 0))
      .reduce((a, b) => a + b, 0),
  });
  const transferred: string[] = [];
  const transfers = [
    ...toPull.map((media) => ({
      id: media.id,
      direction: "pull",
      run: () =>
        downloadMedia({
          host: cloudConnection.host,
          media,
          mediaHandler,
          organizationId: cloudConnection.organization_id,
          userId: cloudConnection.creator_user_id,
          onBytes: (n) => hooks.onBytes?.(n),
        }),
    })),
    ...toPush.map((media) => ({
      id: media.id,
      direction: "push",
      run: () =>
        uploadMedia({
          host: cloudConnection.host,
          sessionCookie: cloudConnection.session_cookie,
          cloudOrganizationId: cloud.organizationId,
          media,
          read: () => mediaHandler.getReadable(media.media_name),
          onBytes: (n) => hooks.onBytes?.(n),
        }),
    })),
  ];
  const pending = [...transfers];
  const next = async (): Promise<void> => {
    const transfer = pending.shift();
    if (!transfer) return;
    try {
      await transfer.run();
      transferred.push(transfer.id);
      if (transfer.direction === "pull") counts.pulled += 1;
      else counts.pushed += 1;
      await hooks.onTransferred?.();
    } catch (err) {
      counts.transferFailed += 1;
      logger.warn(
        { err, mediaId: transfer.id, direction: transfer.direction },
        "Failed to transfer media; retrying next sync",
      );
    }
    return next();
  };
  await Promise.all(Array.from({ length: TRANSFER_CONCURRENCY }, next));

  const bothSides = new Set([
    ...[...local.media.keys()].filter(
      (id) => cloudMedia.has(id) && !deleting.has(id),
    ),
    ...transferred,
  ]);
  const isUpload = (id: string) =>
    local.media.get(id)?.is_user_uploaded ?? cloudMedia.get(id)!.isUserUploaded;
  await recordState(
    withPgClient,
    cloudConnection.id,
    MEDIA,
    [...bothSides].filter(isUpload).map((id) => ({ id })),
  );

  // ---- Metadata ----
  await withPgClient(async (pgClient) => {
    await pgClient.query("begin");
    try {
      await writeMediaMetadata(
        pgClient,
        metadataWithin(cloud.metadata, bothSides),
      );
      await pgClient.query("commit");
    } catch (err) {
      await pgClient.query("rollback");
      throw err;
    }
  });
  const localMetadata = await withPgClient((pgClient) =>
    readMediaMetadata(pgClient, [...bothSides]),
  );
  await pushMetadata(
    urqlClient,
    organizationSlug,
    missingFrom(metadataWithin(localMetadata, bothSides), cloud.metadata),
  );

  // ---- Link additions ----
  const addedHere = addHere.filter((l) => bothSides.has(l.link.mediaId));
  if (addedHere.length > 0) {
    await withPgClient((pgClient) =>
      pgClient.query(
        `insert into app_public.project_medias (project_id, media_id, plugin_id)
         select "localProjectId", "mediaId", "pluginId"
         from jsonb_to_recordset($1::jsonb)
           as x("localProjectId" uuid, "mediaId" uuid, "pluginId" uuid)
         on conflict do nothing`,
        [JSON.stringify(addedHere.map((l) => l.local))],
      ),
    );
  }
  const toAddOnCloud = addOnCloud.filter((l) => bothSides.has(l.link.mediaId));
  const addResults = await pushLinks(
    urqlClient,
    organizationSlug,
    toAddOnCloud.map((l) => ({ ...l.link, remove: false })),
  );
  const addedOnCloud = toAddOnCloud.filter(
    (_l, i) => addResults[i] === "applied",
  );
  counts.linksAdded = addedHere.length + addedOnCloud.length;
  await recordState(withPgClient, cloudConnection.id, LINKS, [
    ...links.filter((l) => l.in_local && l.in_cloud).map((l) => l.link),
    ...addedHere.map((l) => l.link),
    ...addedOnCloud.map((l) => l.link),
  ]);

  return counts;
};

/**
 * The media to copy to the other side: uploads it lacks, plugin media a link
 * being added there needs, and plugin media derived from either, or from
 * what is there already. User uploads are only ever in `uploads`: what
 * exists of them is the library's, not derivation's, to decide.
 */
const needed = ({
  uploads,
  linked,
  there,
  here,
  children,
  isUpload,
}: {
  uploads: string[];
  linked: string[];
  there: string[];
  here: Map<string, unknown>;
  children: Map<string, string[]>;
  isUpload: (id: string) => boolean;
}): string[] => {
  const present = new Set(there);
  const result = new Set<string>();
  const add = (id: string) => {
    if (!here.has(id) || result.has(id)) return;
    if (!present.has(id)) result.add(id);
    for (const child of children.get(id) ?? []) {
      if (here.has(child) && !isUpload(child)) add(child);
    }
  };
  uploads.forEach(add);
  linked.filter((id) => here.has(id) && !isUpload(id)).forEach(add);
  there.forEach((id) => {
    for (const child of children.get(id) ?? []) {
      if (here.has(child) && !isUpload(child)) add(child);
    }
  });
  return [...result];
};

/** `ids` and everything derived from them. */
const withDerived = (ids: string[], children: Map<string, string[]>) => {
  const all = new Set<string>();
  const visit = (id: string) => {
    if (all.has(id)) return;
    all.add(id);
    (children.get(id) ?? []).forEach(visit);
  };
  ids.forEach(visit);
  return all;
};

const childrenMap = (dependencies: MediaMetadata["dependencies"]) => {
  const children = new Map<string, string[]>();
  for (const d of dependencies) {
    children.set(d.parentMediaId, [
      ...(children.get(d.parentMediaId) ?? []),
      d.childMediaId,
    ]);
  }
  return children;
};

const listCloud = async (
  urqlClient: Client,
  organizationSlug: string,
): Promise<Omit<CloudMediaPage, "endCursor">> => {
  const all: Omit<CloudMediaPage, "endCursor"> = {
    organizationId: "",
    media: [],
    metadata: emptyMediaMetadata(),
    links: [],
  };
  let after: string | null = null;
  let knowsAudio = false;
  do {
    const { cloudMediaSyncPage: page }: { cloudMediaSyncPage: CloudMediaPage } =
      await queryCloud(urqlClient, CLOUD_MEDIA_SYNC_PAGE, {
        organizationSlug,
        after,
      });
    all.organizationId = page.organizationId;
    all.media.push(...page.media);
    all.links.push(...page.links);
    knowsAudio ||= !!page.metadata.audioMetadata;
    for (const key of Object.keys(all.metadata) as (keyof MediaMetadata)[]) {
      (all.metadata[key] as unknown[]).push(...(page.metadata[key] ?? []));
    }
    after = page.endCursor;
  } while (after);
  if (!knowsAudio) delete all.metadata.audioMetadata;
  return all;
};

/** Complete media here, and what each was derived from. */
const listLocal = async (
  withPgClient: WithPgClient,
  cloudConnection: CloudConnection,
) =>
  withPgClient(async (pgClient) => {
    const { rows: media } = await pgClient.query<LocalMedia>(
      `select m.id, m.media_name, m.file_size::text, m.original_name,
         m.is_user_uploaded
       from app_public.medias m
       where m.organization_id = $1 and m.is_complete`,
      [cloudConnection.organization_id],
    );
    const { rows: dependencies } = await pgClient.query<
      MediaMetadata["dependencies"][number]
    >(
      `select d.parent_media_id as "parentMediaId",
         d.child_media_id as "childMediaId"
       from app_public.media_dependencies d
       join app_public.medias m on m.id = d.parent_media_id
       where m.organization_id = $1`,
      [cloudConnection.organization_id],
    );
    return {
      media: new Map(media.map((m) => [m.id, m])),
      children: childrenMap(dependencies),
    };
  });

/** User uploads both sides had at the last sync. */
const syncedUploads = async (
  withPgClient: WithPgClient,
  cloudConnectionId: string,
) => {
  const { rows } = await withPgClient((pgClient) =>
    pgClient.query<{ id: string }>(
      `select row_key ->> 'id' as id from app_private.cloud_sync_rows
       where cloud_connection_id = $1 and entity = $2`,
      [cloudConnectionId, MEDIA],
    ),
  );
  return new Set(rows.map((r) => r.id));
};

type LinkRow = {
  link: MediaLink;
  local: { localProjectId: string | null; mediaId: string; pluginId: string };
  in_cloud: boolean;
  in_local: boolean;
  has_state: boolean;
};

/** Links of synced projects, on each side and in the state. */
const compareLinks = async (
  withPgClient: WithPgClient,
  cloudConnection: CloudConnection,
  cloudLinks: MediaLink[],
  syncedProjects: Set<string>,
): Promise<LinkRow[]> => {
  const { rows } = await withPgClient((pgClient) =>
    pgClient.query(
      `
        with cloud as (
          select * from jsonb_to_recordset($3::jsonb)
            as c("projectId" uuid, "mediaId" uuid, "pluginId" uuid)
        ),
        local as (
          select p.cloud_project_id as "projectId", pm.media_id as "mediaId",
            pm.plugin_id as "pluginId"
          from app_public.project_medias pm
          join app_public.projects p on p.id = pm.project_id
          where p.organization_id = $4
            and p.cloud_project_id = any($5::uuid[])
        ),
        state as (
          select (s.row_key ->> 'projectId')::uuid as "projectId",
            (s.row_key ->> 'mediaId')::uuid as "mediaId",
            (s.row_key ->> 'pluginId')::uuid as "pluginId"
          from app_private.cloud_sync_rows s
          where s.cloud_connection_id = $1 and s.entity = $2
            and (s.row_key ->> 'projectId')::uuid = any($5::uuid[])
        ),
        keys as (
          select "projectId", "mediaId", "pluginId" from cloud
          union select "projectId", "mediaId", "pluginId" from local
          union select "projectId", "mediaId", "pluginId" from state
        )
        select
          jsonb_build_object('projectId', k."projectId",
            'mediaId', k."mediaId", 'pluginId', k."pluginId") as link,
          jsonb_build_object(
            'localProjectId', (
              select p.id from app_public.projects p
              where p.organization_id = $4 and p.cloud_project_id = k."projectId"
            ),
            'mediaId', k."mediaId", 'pluginId', k."pluginId") as local,
          exists (select 1 from cloud c where (c."projectId", c."mediaId", c."pluginId")
                  = (k."projectId", k."mediaId", k."pluginId")) as in_cloud,
          exists (select 1 from local l where (l."projectId", l."mediaId", l."pluginId")
                  = (k."projectId", k."mediaId", k."pluginId")) as in_local,
          exists (select 1 from state s where (s."projectId", s."mediaId", s."pluginId")
                  = (k."projectId", k."mediaId", k."pluginId")) as has_state
        from keys k
      `,
      [
        cloudConnection.id,
        LINKS,
        JSON.stringify(cloudLinks),
        cloudConnection.organization_id,
        [...syncedProjects],
      ],
    ),
  );
  return rows as LinkRow[];
};

/** The cloud's media in use, by the same rule as `mediaInUse`. */
const cloudMediaInUse = (
  cloud: Omit<CloudMediaPage, "endCursor">,
  links: Set<string>,
): Set<string> => {
  const linked = new Set(
    cloud.links.filter((l) => links.has(linkKey(l))).map((l) => l.mediaId),
  );
  const children = childrenMap(cloud.metadata.dependencies);
  const used = (id: string, seen: Set<string>): boolean => {
    if (linked.has(id)) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return (children.get(id) ?? []).some((c) => used(c, seen));
  };
  return new Set(
    cloud.media.map((m) => m.id).filter((id) => used(id, new Set())),
  );
};

/** Local rows the cloud does not already have. */
const missingFrom = (
  local: MediaMetadata,
  cloud: MediaMetadata,
): MediaMetadata => {
  const keyed = <T>(rows: T[], key: (r: T) => string) => new Set(rows.map(key));
  const json = (r: unknown) => JSON.stringify(r);
  const dependency = (r: MediaMetadata["dependencies"][number]) =>
    `${r.parentMediaId}/${r.childMediaId}`;
  const size = (r: MediaMetadata["imageSizes"][number]) =>
    `${r.imageMediaId}/${r.width}/${r.fileType}`;
  const image = (r: MediaMetadata["imageMetadata"][number]) =>
    json([r.imageMediaId, r.width, r.height]);
  const video = (r: MediaMetadata["videoMetadata"][number]) =>
    json([
      r.videoMediaId,
      r.hlsMediaId,
      r.thumbnailMediaId,
      r.mp4MediaId,
      r.duration === null ? null : Number(r.duration),
      r.transcodeStatus,
    ]);
  const audio = (r: NonNullable<MediaMetadata["audioMetadata"]>[number]) =>
    json([
      r.audioMediaId,
      r.playbackMediaId,
      r.coverMediaId,
      r.duration === null ? null : Number(r.duration),
      r.title,
      r.artist,
      r.album,
      r.normalizeLoudness,
      r.transcodeStatus,
    ]);
  const has = {
    dependencies: keyed(cloud.dependencies, dependency),
    imageSizes: keyed(cloud.imageSizes, size),
    imageMetadata: keyed(cloud.imageMetadata, image),
    videoMetadata: keyed(cloud.videoMetadata, video),
    audioMetadata: keyed(cloud.audioMetadata ?? [], audio),
  };
  return {
    dependencies: local.dependencies.filter(
      (r) => !has.dependencies.has(dependency(r)),
    ),
    imageSizes: local.imageSizes.filter((r) => !has.imageSizes.has(size(r))),
    imageMetadata: local.imageMetadata.filter(
      (r) => !has.imageMetadata.has(image(r)),
    ),
    videoMetadata: local.videoMetadata.filter(
      (r) => !has.videoMetadata.has(video(r)),
    ),
    audioMetadata: cloud.audioMetadata
      ? (local.audioMetadata ?? []).filter(
          (r) => !has.audioMetadata.has(audio(r)),
        )
      : [],
  };
};

const pushLinks = async (
  urqlClient: Client,
  organizationSlug: string,
  links: LinkChange[],
): Promise<("applied" | "rejected")[]> => {
  const results: ("applied" | "rejected")[] = [];
  for (const batch of inBatches(links, PUSH_BATCH)) {
    const { cloudMediaSyncPush } = await queryCloud<{
      cloudMediaSyncPush: { links: ("applied" | "rejected")[] };
    }>(
      urqlClient,
      CLOUD_MEDIA_SYNC_PUSH,
      { organizationSlug, metadata: emptyMediaMetadata(), links: batch },
      "mutation",
    );
    results.push(...cloudMediaSyncPush.links);
  }
  return results;
};

const pushMetadata = async (
  urqlClient: Client,
  organizationSlug: string,
  metadata: MediaMetadata,
) => {
  const rows = (Object.keys(metadata) as (keyof MediaMetadata)[]).flatMap(
    (table) => (metadata[table] ?? []).map((row) => ({ table, row })),
  );
  for (const batch of inBatches(rows, PUSH_BATCH)) {
    const part = emptyMediaMetadata();
    for (const { table, row } of batch) {
      (part[table] as unknown[]).push(row);
    }
    await queryCloud(
      urqlClient,
      CLOUD_MEDIA_SYNC_PUSH,
      { organizationSlug, metadata: part, links: [] },
      "mutation",
    );
  }
};

const recordState = (
  withPgClient: WithPgClient,
  cloudConnectionId: string,
  entity: string,
  keys: object[],
) =>
  keys.length === 0
    ? Promise.resolve()
    : withPgClient((pgClient) =>
        pgClient.query(
          `insert into app_private.cloud_sync_rows
             (cloud_connection_id, entity, row_key)
           select $1, $2, k from jsonb_array_elements($3::jsonb) as k
           on conflict do nothing`,
          [cloudConnectionId, entity, JSON.stringify(keys)],
        ),
      );

const forgetState = (
  withPgClient: WithPgClient,
  cloudConnectionId: string,
  entity: string,
  keys: object[],
) =>
  keys.length === 0
    ? Promise.resolve()
    : withPgClient((pgClient) =>
        pgClient.query(
          `delete from app_private.cloud_sync_rows
           where cloud_connection_id = $1 and entity = $2
             and row_key in (select jsonb_array_elements($3::jsonb))`,
          [cloudConnectionId, entity, JSON.stringify(keys)],
        ),
      );

/**
 * Forget the link state of projects: ones just created on a side, whose
 * links are not there yet, which is not their removal; and ones gone from
 * both sides.
 */
export const forgetProjectLinks = (
  withPgClient: WithPgClient,
  cloudConnectionId: string,
  projectIds: string[],
) =>
  projectIds.length === 0
    ? Promise.resolve()
    : withPgClient((pgClient) =>
        pgClient.query(
          `delete from app_private.cloud_sync_rows
           where cloud_connection_id = $1 and entity = $2
             and row_key ->> 'projectId' = any($3::text[])`,
          [cloudConnectionId, LINKS, projectIds],
        ),
      );
