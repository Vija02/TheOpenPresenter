import { ClientPluginBuildStatus } from "@repo/graphql";
import { Badge, Button, PopConfirm, Switch } from "@repo/ui";

import { Organization, Plugin } from "./types";

type Install = Organization["organizationClientPlugins"]["nodes"][number];

export const PluginRow = ({
  plugin,
  install,
  hasBuiltVersion,
  onEdit,
  onDetails,
  onDelete,
  onToggleEnabled,
}: {
  plugin: Plugin;
  install: Install | null;
  hasBuiltVersion: boolean;
  onEdit: () => void;
  onDetails: () => void;
  onDelete: () => void;
  onToggleEnabled: (enabled: boolean) => void;
}) => {
  const versions = plugin.clientPluginVersions.nodes;
  const latestBuilt = versions.find(
    (v) => v.buildStatus === ClientPluginBuildStatus.Built,
  );
  const lastFailed =
    !latestBuilt &&
    versions.some((v) => v.buildStatus === ClientPluginBuildStatus.Failed);

  const pinnedVersion = install?.pinnedVersionId
    ? versions.find((v) => v.id === install.pinnedVersionId)
    : null;

  return (
    <div className="flex items-center gap-3 w-full border rounded px-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{plugin.title}</span>
          {hasBuiltVersion ? (
            <Badge size="sm">
              {pinnedVersion
                ? `pinned ${pinnedVersion.version}`
                : `latest ${latestBuilt?.version ?? ""}`}
            </Badge>
          ) : lastFailed ? (
            <Badge size="sm">build failed</Badge>
          ) : (
            <Badge size="sm">draft</Badge>
          )}
        </div>
        <div className="text-xs text-tertiary truncate">
          {plugin.handle}
          {versions.length > 0 && ` · ${versions.length} version(s)`}
        </div>
      </div>

      {hasBuiltVersion && install ? (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-secondary">
            {install.enabled ? "Enabled" : "Disabled"}
          </span>
          <Switch
            checked={install.enabled}
            onCheckedChange={(c: boolean) => onToggleEnabled(c)}
          />
        </div>
      ) : (
        <span className="text-xs text-secondary shrink-0">Not published</span>
      )}

      <div className="flex gap-2 shrink-0">
        <Button size="sm" onClick={onEdit}>
          Edit
        </Button>
        <Button variant="outline" size="sm" onClick={onDetails}>
          Details
        </Button>
        <PopConfirm
          title="Are you sure you want to delete this plugin?"
          description="This action is not reversible. All published versions will be deleted and any scene using this plugin will stop rendering."
          onConfirm={onDelete}
          okText="Yes"
          cancelText="No"
          key="remove"
        >
          <Button variant="destructive" size="sm">
            Delete
          </Button>
        </PopConfirm>
      </div>
    </div>
  );
};
