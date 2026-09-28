import { zodResolver } from "@hookform/resolvers/zod";
import { ProjectFragment, useDuplicateProjectMutation } from "@repo/graphql";
import { globalState } from "@repo/lib";
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
  useOverlayToggle,
} from "@repo/ui";
import { format } from "date-fns";
import { useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { z } from "zod";

const formSchema = z.object({
  name: z.string().optional(),
});

type FormInputs = z.infer<typeof formSchema>;

export type DuplicateProjectModalPropTypes = {
  project: ProjectFragment;
};

/** Mirrors the name the dashboard shows for a project without one. */
const displayName = (project: ProjectFragment) =>
  project.name !== ""
    ? project.name
    : `Untitled (${format(new Date(project.createdAt), "do MMM yyyy")})`;

const DuplicateProjectModal = ({ project }: DuplicateProjectModalPropTypes) => {
  const { isOpen, onToggle, resetData } = useOverlayToggle();

  const [, duplicateProject] = useDuplicateProjectMutation();
  const { publish } = globalState.modelDataAccess.usePublishAPIChanges({
    token: "page",
  });

  const defaultName = useMemo(
    () => `${displayName(project)} (copy)`,
    [project],
  );

  const handleSubmit = useCallback(
    async (data: FormInputs) => {
      const name = data.name?.trim();

      try {
        await duplicateProject({
          projectId: project.id,
          name: name === "" ? undefined : name,
        });
        publish();
        toast.success("Project duplicated");
      } catch (e: any) {
        toast.error(
          "Error occurred when duplicating this project: " + e.message,
        );
      }

      onToggle?.();
      resetData?.();
    },
    [duplicateProject, onToggle, project.id, publish, resetData],
  );

  const form = useForm<FormInputs>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: defaultName,
    },
  });

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle}>
      <Form {...form}>
        <DialogContent
          className="max-w-2xl"
          render={<form onSubmit={form.handleSubmit(handleSubmit)} />}
        >
          <DialogHeader>
            <DialogTitle>Duplicate Project</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-secondary mb-3">
              This makes a copy of "{displayName(project)}", including its
              content, category and tags.
            </p>

            <InputControl
              control={form.control}
              name="name"
              label="Name"
              placeholder={defaultName}
            />
          </DialogBody>
          <DialogFooter>
            <div className="flex gap-2">
              <Button type="submit" variant="success">
                Duplicate
              </Button>
              <Button variant="outline" onClick={onToggle}>
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Form>
    </Dialog>
  );
};

export default DuplicateProjectModal;
