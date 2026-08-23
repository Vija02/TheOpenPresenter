import { PoolClient } from "pg";

import {
  REMOTE_CSS_FILE,
  REMOTE_JS_FILE,
  RENDERER_CSS_FILE,
  RENDERER_JS_FILE,
  clientPluginVersionName,
  remoteTag,
  rendererTag,
  runtimePluginName,
} from "./naming";

export type ResolvedClientPluginView = {
  /** Name versioned */
  pluginName: string;
  pluginFamily: string;
  versionId: string;
  /** True for the version a NEW scene should be created with */
  isInstallDefault: boolean;
  remote: { tag: string; scripts: string[]; css: string[] };
  renderer: { tag: string; scripts: string[]; css: string[] };
  title: string;
  description: string;
  manifest: {
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
      p.title as plugin_title,
      p.description as plugin_description,
      v.id as version_id,
      v.manifest as manifest,
      v.artifacts as artifacts,
      (v.id = first_value(v.id) over (
         partition by ocp.organization_id, ocp.client_plugin_id
         order by (v.id = ocp.pinned_version_id) desc, v.created_at desc
       )) as is_install_default
    from app_public.organization_client_plugins ocp
    join app_public.client_plugins p on p.id = ocp.client_plugin_id
    join app_public.client_plugin_versions v
      on v.client_plugin_id = p.id
     and v.build_status = 'built'
    where ocp.enabled = true
      and ($1::uuid is null or ocp.organization_id = $1::uuid)
    `,
    [organizationId ?? null],
  );

  return rows.map((row): ResolvedClientPluginView => {
    const pluginName = clientPluginVersionName(
      row.client_plugin_id,
      row.version_id,
    );
    const filenames: string[] = ((row.artifacts ?? []) as any[]).map(
      (a) => a.filename,
    );
    const manifest = (row.manifest ?? {}) as Record<string, any>;

    const has = (f: string) => filenames.includes(f);

    return {
      pluginName,
      pluginFamily: runtimePluginName(row.client_plugin_id),
      versionId: row.version_id,
      isInstallDefault: row.is_install_default === true,
      remote: {
        tag: remoteTag(row.client_plugin_id, row.version_id),
        scripts: has(REMOTE_JS_FILE)
          ? [staticUrl(row.version_id, REMOTE_JS_FILE)]
          : [],
        css: has(REMOTE_CSS_FILE)
          ? [staticUrl(row.version_id, REMOTE_CSS_FILE)]
          : [],
      },
      renderer: {
        tag: rendererTag(row.client_plugin_id, row.version_id),
        scripts: has(RENDERER_JS_FILE)
          ? [staticUrl(row.version_id, RENDERER_JS_FILE)]
          : [],
        css: has(RENDERER_CSS_FILE)
          ? [staticUrl(row.version_id, RENDERER_CSS_FILE)]
          : [],
      },
      title: row.plugin_title || "Untitled plugin",
      description: row.plugin_description || "",
      manifest: {
        pluginData: manifest.pluginData ?? {},
        rendererData: manifest.rendererData ?? {},
      },
    };
  });
}
