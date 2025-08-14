import { ReactSelectDateProps } from "@/components/DatePicker/datePickerReactSelect";
import { TagsSelector } from "@/components/Tag/TagsSelector";
import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CategoryFragment,
  useCreateProjectMutation,
  useCreateTagMutation,
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
import { format } from "date-fns";
import { generateSlug } from "random-word-slugs";
import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
  name: z.string().optional(),
  categoryId: z.string().optional(),
  targetDate: z.date().optional(),
});

type FormInputs = z.infer<typeof formSchema>;

export type CreateProjectModalPropTypes = {
  isOpen?: boolean;
  onToggle?: () => void;
  resetData?: () => void;
  organizationId: string;
  categories: CategoryFragment[];
} & Partial<OverlayToggleComponentProps>;

const UNCATEGORIZED = "uncategorized";

const CreateProjectModal = ({
  isOpen,
  onToggle,
  resetData,
  organizationId,
  categories,
}: CreateProjectModalPropTypes) => {
  const [createProject] = useCreateProjectMutation();
  const slug = useOrganizationSlug();

  const namePlaceholder = useMemo(
    () => `Untitled (${format(new Date(), "do MMM yyyy")})`,
    [],
  );

  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

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
      name: "",
      categoryId: UNCATEGORIZED,
      targetDate: undefined,
    },
  });

  const handleSubmit = useCallback(
    (data: FormInputs) => {
      createProject({
        variables: {
          organizationId,
          slug: generateSlug(),
          name: data.name ?? "",
          categoryId:
            data.categoryId === UNCATEGORIZED ? undefined : data.categoryId,
          tags: selectedTagIds,
          targetDate: data.targetDate ? data.targetDate.toDateString() : null,
        },
      }).then((x) => {
        const projectSlug = x.data?.createFullProject?.project?.slug;

        window.location.href = `/app/${slug}/${projectSlug}`;
      });

      onToggle?.();
      resetData?.();
    },
    [createProject, onToggle, organizationId, resetData, selectedTagIds, slug],
  );

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle}>
      <Form {...form}>
        <DialogContent className="max-w-2xl" asChild>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <DialogHeader>
              <DialogTitle>New Project</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <InputControl
                control={form.control}
                name="name"
                label="Name"
                placeholder={namePlaceholder}
              />

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

export default CreateProjectModal;
