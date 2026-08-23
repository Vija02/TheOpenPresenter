import { PluginsList } from "./PluginsList";
import { Organization } from "./types";

export const PluginsPage = ({
  organization,
  refetch,
}: {
  organization: Organization;
  refetch: () => void;
}) => {
  return (
    <div className="stack-col items-start gap-4">
      <h1 className="text-2xl font-bold">Plugins</h1>
      <p className="text-secondary max-w-2xl">
        Show anything you want by creating your own plugins.
      </p>

      <PluginsList organization={organization} refetch={refetch} />
    </div>
  );
};
