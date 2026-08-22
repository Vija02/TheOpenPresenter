import { PoolClient } from "pg";

import {
  REMOTE_CSS_FILE,
  REMOTE_JS_FILE,
  RENDERER_CSS_FILE,
  RENDERER_JS_FILE,
  remoteTag,
  rendererTag,
  runtimePluginName,
} from "./naming";

export type ResolvedClientPluginView = {
  pluginName: string;
  versionId: string;
  remote: { tag: string; scripts: string[]; css: string[] };
  renderer: { tag: string; scripts: string[]; css: string[] };
  manifest: {
    title: string;
    description: string;
    categories: string[];
    organizationTypes: string[] | null;
    pluginData: Record<string, unknown>;
    rendererData: Record<string, unknown>;
  };
};

const staticUrl = (versionId: string, filename: string) =>
  `/cplugin/${versionId}/${filename}`;

export async function resolveClientPluginsForOrg(
  client: PoolClient,
  organizationId?: string | null,
): Promise<ResolvedClientPluginView[]> {
  const { rows } = await client.query(
    `
    select
      p.id as client_plugin_id,
      v.id as version_id,
      v.manifest as manifest,
      v.artifacts as artifacts
    from app_public.organization_client_plugins ocp
    join app_public.client_plugins p on p.id = ocp.client_plugin_id
    join app_public.client_plugin_versions v on v.id = ocp.pinned_version_id
    where ocp.enabled = true
      and v.build_status = 'built'
      and ($1::uuid is null or ocp.organization_id = $1::uuid)
    `,
    [organizationId ?? null],
  );

  return rows.map((row): ResolvedClientPluginView => {
    const pluginName = runtimePluginName(row.client_plugin_id, row.version_id);
    const filenames: string[] = ((row.artifacts ?? []) as any[]).map(
      (a) => a.filename,
    );
    const manifest = (row.manifest ?? {}) as Record<string, any>;

    const has = (f: string) => filenames.includes(f);

    return {
      pluginName,
      versionId: row.version_id,
      remote: {
        tag: remoteTag(pluginName),
        scripts: has(REMOTE_JS_FILE)
          ? [staticUrl(row.version_id, REMOTE_JS_FILE)]
          : [],
        css: has(REMOTE_CSS_FILE)
          ? [staticUrl(row.version_id, REMOTE_CSS_FILE)]
          : [],
      },
      renderer: {
        tag: rendererTag(pluginName),
        scripts: has(RENDERER_JS_FILE)
          ? [staticUrl(row.version_id, RENDERER_JS_FILE)]
          : [],
        css: has(RENDERER_CSS_FILE)
          ? [staticUrl(row.version_id, RENDERER_CSS_FILE)]
          : [],
      },
      manifest: {
        title: manifest.title ?? "Untitled plugin",
        description: manifest.description ?? "",
        categories: manifest.categories ?? [],
        organizationTypes: manifest.organizationTypes ?? null,
        pluginData: manifest.pluginData ?? {},
        rendererData: manifest.rendererData ?? {},
      },
    };
  });
}
