import { TagsSelector } from "@/components/Tag/TagsSelector";
import { noCategoryLabel } from "@/lib/categorySchedule";
import { getOrgTypeLabels } from "@/lib/organizationType";
import { useOrganizationType } from "@/lib/permissionHooks/organization";
import {
  fromProjectDateValue,
  fromProjectTimeValue,
  toProjectDateValue,
  toProjectTimeValue,
} from "@/lib/projectDate";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CategoryFragment,
  ProjectFragment,
  useCreateProjectTagMutation,
  useCreateTagMutation,
  useDeleteProjectTagMutation,
  useUpdateProjectMutation,
} from "@repo/graphql";
import { globalState } from "@repo/lib";
import {
  Button,
  DateInputControl,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormLabel,
  InputControl,
  SelectControl,
  TimeInputControl,
  useOverlayToggle,
} from "@repo/ui";
import { useCallback, useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
  name: z.string().optional(),
  categoryId: z.string().optional(),
  targetDate: z.date().optional(),
  targetTime: z.string(),
});

type FormInputs = z.infer<typeof formSchema>;

const UNCATEGORIZED = "uncategorized";

export type EditProjectModalPropTypes = {
  organizationId: string;
  categories: CategoryFragment[];
  project: ProjectFragment;
};

const EditProjectModal = ({
  organizationId,
  categories,
  project,
}: EditProjectModalPropTypes) => {
  const labels = getOrgTypeLabels(useOrganizationType());
  const { isOpen, onToggle, resetData } = useOverlayToggle();

  const [, updateProject] = useUpdateProjectMutation();
  const [, createProjectTag] = useCreateProjectTagMutation();
  const [, deleteProjectTag] = useDeleteProjectTagMutation();

  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    project.projectTags.nodes.map((x) => x.tag?.id),
  );
  // Update value when change (after update)
  useEffect(() => {
    const actualValue = project.projectTags.nodes.map((x) => x.tag?.id);
    setSelectedTagIds(actualValue);
  }, [project.projectTags.nodes]);

  const { publish } = globalState.modelDataAccess.usePublishAPIChanges({
    token: "page",
  });

  const { allTagByOrganization, refetch: refetchTags } =
    globalState.modelDataAccess.useTag();
  const [, createTag] = useCreateTagMutation();

  const form = useForm<FormInputs>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: project.name,
      categoryId: project.category?.id || UNCATEGORIZED,
      targetDate: project.targetDate
        ? fromProjectDateValue(project.targetDate)
        : undefined,
      targetTime: project.targetDate
        ? fromProjectTimeValue(project.targetTime)
        : "",
    },
  });
  const targetDate = useWatch({ control: form.control, name: "targetDate" });

  const handleSubmit = useCallback(
    async (data: FormInputs) => {
      await updateProject({
        id: project.id,
        name: data.name,
        categoryId:
          data.categoryId === UNCATEGORIZED ? undefined : data.categoryId,
        targetDate: data.targetDate
          ? toProjectDateValue(data.targetDate)
          : null,
        targetTime: data.targetDate
          ? toProjectTimeValue(data.targetTime)
          : null,
      });
      const existingTagIds = project.projectTags.nodes.map((x) => x.tag?.id);
      const newTagIds = selectedTagIds;

      const missingTagIds = newTagIds.filter(
        (x) => !existingTagIds.includes(x),
      );
      const nonMissingTagIds = existingTagIds.filter(
        (x) => !newTagIds.includes(x),
      );

      const createPromises = missingTagIds.map((id) =>
        createProjectTag({
          projectId: project.id,
          tagId: id,
        }),
      );
      const deletePromises = nonMissingTagIds.map((id) =>
        deleteProjectTag({
          id: project.projectTags.nodes.find((x) => x.tag?.id === id)?.id,
        }),
      );

      await Promise.all([...createPromises, ...deletePromises]);

      publish();

      onToggle?.();
      resetData?.();
    },
    [
      createProjectTag,
      deleteProjectTag,
      onToggle,
      project.id,
      project.projectTags.nodes,
      publish,
      resetData,
      selectedTagIds,
      updateProject,
    ],
  );

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle}>
      <Form {...form}>
        <DialogContent
          className="max-w-2xl"
          render={<form onSubmit={form.handleSubmit(handleSubmit)} />}
        >
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <InputControl control={form.control} name="name" label="Name" />

            <div className="grid grid-cols-2 items-start gap-3 md:grid-cols-[1fr_auto]">
              <DateInputControl
                control={form.control}
                name="targetDate"
                label={labels.projectDate}
              />
              <TimeInputControl
                control={form.control}
                name="targetTime"
                label="Time"
                disabled={!targetDate}
                className="md:w-32"
              />
            </div>

            <SelectControl
              control={form.control}
              name="categoryId"
              label="Category"
              options={categories
                .map((x) => ({ label: x.name, value: x.id }))
                .concat({
                  label: noCategoryLabel(categories),
                  value: UNCATEGORIZED,
                })}
            />

            <div>
              <FormLabel className="mb-2">Tags</FormLabel>
              <TagsSelector
                value={selectedTagIds.map((tagId) => ({
                  value: allTagByOrganization?.find((tag) => tag.id === tagId),
                  label:
                    allTagByOrganization?.find((tag) => tag.id === tagId)
                      ?.name ?? "",
                }))}
                onChange={(val) => {
                  const selectedIds: string[] =
                    val.map((x: any) => x.value.id) ?? [];

                  setSelectedTagIds(selectedIds);
                }}
                onCreateOption={async (optionName: string) => {
                  await createTag({
                    name: optionName,
                    organizationId: organizationId,
                  });
                  refetchTags?.();
                }}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            {/* Same order and alignment as New Project */}
            <div className="flex w-full flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={onToggle}>
                Cancel
              </Button>
              <Button type="submit" variant="success">
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Form>
    </Dialog>
  );
};

export default EditProjectModal;
