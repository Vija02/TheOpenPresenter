import { zodResolver } from "@hookform/resolvers/zod";
import { useUpdateProjectMutation } from "@repo/graphql";
import { usePluginMetaData } from "@repo/shared";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  InputControl,
  OverlayToggleComponentProps,
} from "@repo/ui";
import { useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { PiExportLight } from "react-icons/pi";
import { toast } from "react-toastify";
import z from "zod";

import { useExportProject } from "../api/useExportProject";

export type ProjectSettingsModalPropTypes =
  Partial<OverlayToggleComponentProps> & {};

const formSchema = z.object({
  name: z.string(),
});

const ProjectSettingsModal = ({
  isOpen,
  onToggle,
  resetData,
}: ProjectSettingsModalPropTypes) => {
  const { pluginMetaData, refetch } = usePluginMetaData();

  const project = useMemo(
    () => pluginMetaData?.organizationBySlug?.projects.nodes[0],
    [pluginMetaData?.organizationBySlug?.projects.nodes],
  );
  const { mutateAsync: exportProject, isPending: exportLoading } =
    useExportProject(project?.id);
  const onExport = useCallback(() => {
    exportProject().then((x) => {
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(new Blob([x.data]));
      link.download = "filename.top";
      link.click();
      window.URL.revokeObjectURL(link.href);

      toast.success("Project exported!");
    });
  }, [exportProject]);

  const [updateProject, { loading }] = useUpdateProjectMutation();

  const handleSubmit = useCallback(
    async ({ name }: { name: string }) => {
      updateProject({ variables: { id: project?.id, name } }).then(() => {
        refetch();

        resetData?.();
        onToggle?.();
      });
    },
    [onToggle, project?.id, refetch, resetData, updateProject],
  );
  const form = useForm({
    resolver: zodResolver(formSchema),
    values: {
      name: project?.name ?? "",
    },
  });

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <Form {...form}>
        <DialogContent size="sm" asChild>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <DialogHeader>
              <DialogTitle>Edit Project</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <div className="stack-col items-start py-2">
                <InputControl control={form.control} label="Name" name="name" />
              </div>
            </DialogBody>
            <DialogFooter className="justify-between">
              <div>
                <Button
                  variant="outline"
                  onClick={onExport}
                  isLoading={exportLoading}
                >
                  <PiExportLight /> Export Project
                </Button>
              </div>
              <div className="stack-row">
                <Button type="submit" isLoading={loading}>
                  Save
                </Button>
                <Button variant="outline" onClick={onToggle}>
                  Close
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Form>
    </Dialog>
  );
};

export default ProjectSettingsModal;
