import {
  ClientPluginBuildStatus,
  useDeleteClientPluginMutation,
  useUpdateOrganizationClientPluginMutation,
} from "@repo/graphql";
import { Alert, Button } from "@repo/ui";
import { useCallback, useState } from "react";
import { toast } from "react-toastify";

import { PluginDetailsModal } from "./PluginDetailsModal";
import { PluginEditorModal } from "./PluginEditorModal";
import { PluginRow } from "./PluginRow";
import { Organization } from "./types";

export const PluginsList = ({
  organization,
  refetch,
}: {
  organization: Organization;
  refetch: () => void;
}) => {
  const [, deletePlugin] = useDeleteClientPluginMutation();
  const [, updateInstall] = useUpdateOrganizationClientPluginMutation();
  const [editingPluginId, setEditingPluginId] = useState<string | null>(null);

  const [detailsFor, setDetailsFor] = useState<string | "new" | null>(null);

  const plugins = organization.clientPluginsByOwnerOrganizationId.nodes;

  const installsByPluginId = new Map(
    organization.organizationClientPlugins.nodes.map((i) => [
      i.clientPluginId,
      i,
    ]),
  );

  const onDelete = useCallback(
    async (id: string) => {
      try {
        await deletePlugin({ input: { id } });
        toast.success("Plugin deleted");
        refetch();
      } catch (e: any) {
        toast.error(e.message);
      }
    },
    [deletePlugin, refetch],
  );

  const onToggleEnabled = useCallback(
    async (clientPluginId: string, enabled: boolean) => {
      try {
        await updateInstall({
          input: {
            organizationId: organization.id,
            clientPluginId,
            patch: { enabled },
          },
        });
        refetch();
      } catch (e: any) {
        toast.error(e.message);
      }
    },
    [organization.id, refetch, updateInstall],
  );

  const editingPlugin = plugins.find((p) => p.id === editingPluginId) ?? null;

  return (
    <div className="stack-col items-start gap-4 w-full">
      <div className="flex items-center justify-between w-full">
        <h2 className="text-lg font-semibold">Your plugins</h2>
        <Button
          variant="success"
          size="sm"
          onClick={() => setDetailsFor("new")}
        >
          New plugin
        </Button>
      </div>

      {plugins.length === 0 ? (
        <Alert title="No plugins yet">
          Create a plugin now to show whatever you want on the screen.
        </Alert>
      ) : (
        <div className="flex flex-col gap-2 w-full">
          {plugins.map((p) => (
            <PluginRow
              key={p.id}
              plugin={p}
              install={installsByPluginId.get(p.id) ?? null}
              hasBuiltVersion={p.clientPluginVersions.nodes.some(
                (v) => v.buildStatus === ClientPluginBuildStatus.Built,
              )}
              onEdit={() => setEditingPluginId(p.id)}
              onDetails={() => setDetailsFor(p.id)}
              onDelete={() => onDelete(p.id)}
              onToggleEnabled={(enabled) => onToggleEnabled(p.id, enabled)}
            />
          ))}
        </div>
      )}

      {detailsFor && (
        <PluginDetailsModal
          organizationId={organization.id}
          plugin={
            detailsFor === "new"
              ? null
              : (plugins.find((p) => p.id === detailsFor) ?? null)
          }
          onClose={() => setDetailsFor(null)}
          onCreated={(id) => setEditingPluginId(id)}
          refetch={refetch}
        />
      )}

      {editingPlugin && (
        <PluginEditorModal
          plugin={editingPlugin}
          onClose={() => setEditingPluginId(null)}
          refetch={refetch}
        />
      )}
    </div>
  );
};
