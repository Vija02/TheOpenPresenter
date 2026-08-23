import { Pool } from "pg";

import { artifactKey, getArtifactStore } from "./artifactStore";
import { buildClientPlugin } from "./build";

export type ArtifactEntry = { filename: string; contentType: string };

export type BuildAndPersistResult =
  | { ok: true; fileCount: number }
  | { ok: false; log: string };

export async function buildAndPersistVersion(
  rootPgPool: Pool,
  versionId: string,
): Promise<BuildAndPersistResult> {
  const {
    rows: [version],
  } = await rootPgPool.query(
    `select id, client_plugin_id, source
       from app_public.client_plugin_versions
      where id = $1`,
    [versionId],
  );

  if (!version) {
    return { ok: false, log: "Version not found" };
  }

  const source = (version.source ?? {}) as Record<string, string>;

  const result = await buildClientPlugin(
    version.client_plugin_id,
    version.id,
    source,
  );

  if (!result.ok) {
    await rootPgPool.query(
      `update app_public.client_plugin_versions
          set build_status = 'failed', build_log = $2, artifacts = '[]'::jsonb
        where id = $1`,
      [versionId, result.log],
    );
    return { ok: false, log: result.log };
  }

  // Write every built file to object storage first. If any write fails we abort before flipping build_status
  const store = getArtifactStore();
  try {
    await Promise.all(
      result.files.map((f) =>
        store.put(artifactKey(versionId, f.filename), f.content, f.contentType),
      ),
    );
  } catch (err: any) {
    await rootPgPool.query(
      `update app_public.client_plugin_versions
          set build_status = 'failed', build_log = $2, artifacts = '[]'::jsonb
        where id = $1`,
      [versionId, `Failed to store artifacts: ${err?.message ?? err}`],
    );
    return { ok: false, log: "Failed to store artifacts" };
  }

  const artifacts: ArtifactEntry[] = result.files.map((f) => ({
    filename: f.filename,
    contentType: f.contentType,
  }));

  await rootPgPool.query(
    `with built_version as (
       update app_public.client_plugin_versions
          set build_status = 'built', build_log = $2, artifacts = $3::jsonb
        where id = $1
        returning client_plugin_id
     )
     update app_public.client_plugins p
        set latest_version_id = $1
       from built_version v
      where p.id = v.client_plugin_id`,
    [versionId, result.log, JSON.stringify(artifacts)],
  );

  return { ok: true, fileCount: result.files.length };
}
