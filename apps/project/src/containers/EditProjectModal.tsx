import { ReactSelectDateProps } from "@/components/DatePicker/datePickerReactSelect";
import { TagsSelector } from "@/components/Tag/TagsSelector";
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
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  InputControl,
  OverlayToggleComponentProps,
  Select,
  SelectControl,
  formatHumanReadableDate,
} from "@repo/ui";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
  name: z.string().optional(),
  categoryId: z.string().optional(),
  targetDate: z.date().optional(),
});

type FormInputs = z.infer<typeof formSchema>;

const UNCATEGORIZED = "uncategorized";

export type EditProjectModalPropTypes = {
  isOpen?: boolean;
  onToggle?: () => void;
  resetData?: () => void;
  organizationId: string;
  categories: CategoryFragment[];
  project: ProjectFragment;
} & Partial<OverlayToggleComponentProps>;

const EditProjectModal = ({
  isOpen,
  onToggle,
  resetData,
  organizationId,
  categories,
  project,
}: EditProjectModalPropTypes) => {
  const [updateProject] = useUpdateProjectMutation();
  const [createProjectTag] = useCreateProjectTagMutation();
  const [deleteProjectTag] = useDeleteProjectTagMutation();

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
  const [createTag] = useCreateTagMutation({
    onCompleted: () => {
      refetchTags?.();
    },
  });

  const form = useForm<FormInputs>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: project.name,
      categoryId: project.category?.id || UNCATEGORIZED,
      targetDate: project.targetDate ? new Date(project.targetDate) : undefined,
    },
  });

  const handleSubmit = useCallback(
    async (data: FormInputs) => {
      await updateProject({
        variables: {
          id: project.id,
          name: data.name,
          categoryId:
            data.categoryId === UNCATEGORIZED ? undefined : data.categoryId,
          targetDate: data.targetDate ? data.targetDate.toDateString() : null,
        },
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
          variables: { projectId: project.id, tagId: id },
        }),
      );
      const deletePromises = nonMissingTagIds.map((id) =>
        deleteProjectTag({
          variables: {
            id: project.projectTags.nodes.find((x) => x.tag?.id === id)?.id,
          },
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
        <DialogContent className="max-w-2xl" asChild>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <DialogHeader>
              <DialogTitle>Edit Project</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <InputControl control={form.control} name="name" label="Name" />

              <FormField
                control={form.control}
                name="targetDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Time</FormLabel>
                    <FormControl>
                      <Select
                        {...ReactSelectDateProps}
                        value={
                          field.value
                            ? {
                                value: field.value,
                                label: formatHumanReadableDate(field.value),
                              }
                            : null
                        }
                        onChange={(val) => {
                          field.onChange(val);
                        }}
                        isClearable
                        isSearchable={false}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <SelectControl
                control={form.control}
                name="categoryId"
                label="Category"
                options={[
                  { label: "Uncategorized", value: UNCATEGORIZED },
                ].concat(
                  categories.map((x) => ({ label: x.name, value: x.id })),
                )}
              />

              <div>
                <FormLabel className="mb-2">Tags</FormLabel>
                <TagsSelector
                  value={selectedTagIds.map((tagId) => ({
                    value: allTagByOrganization?.find(
                      (tag) => tag.id === tagId,
                    ),
                    label:
                      allTagByOrganization?.find((tag) => tag.id === tagId)
                        ?.name ?? "",
                  }))}
                  onChange={(val) => {
                    const selectedIds: string[] =
                      val.map((x: any) => x.value.id) ?? [];

                    setSelectedTagIds(selectedIds);
                  }}
                  onCreateOption={(optionName: string) =>
                    createTag({
                      variables: {
                        name: optionName,
                        organizationId: organizationId,
                      },
                    })
                  }
                />
              </div>
            </DialogBody>
            <DialogFooter>
              <div className="flex gap-2">
                <Button type="submit" variant="success">
                  Save
                </Button>
                <Button onClick={onToggle}>Close</Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Form>
    </Dialog>
  );
};

export default EditProjectModal;
