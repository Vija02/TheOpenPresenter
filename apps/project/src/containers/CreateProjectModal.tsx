import { ReactSelectDateProps } from "@/components/DatePicker/datePickerReactSelect";
import { TagsSelector } from "@/components/Tag/TagsSelector";
import { categoryNextDate } from "@/lib/categorySchedule";
import { getOrgTypeLabels } from "@/lib/organizationType";
import {
  useOrganizationSlug,
  useOrganizationType,
} from "@/lib/permissionHooks/organization";
import { toProjectDateValue, toProjectTimeValue } from "@/lib/projectDate";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CategoryFragment,
  useCreateProjectMutation,
  useCreateTagMutation,
} from "@repo/graphql";
import {
  formatCategoryTime,
  globalState,
  projectTitle,
  untitledProjectName,
} from "@repo/lib";
import { logger } from "@repo/observability";
import { captureEvent } from "@repo/observability/initAnalytics";
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
  Select,
  SelectControl,
  TimeInputControl,
  formatHumanReadableDate,
  useOverlayToggle,
} from "@repo/ui";
import { generateSlug } from "random-word-slugs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
  name: z.string().optional(),
  categoryId: z.string().optional(),
  targetDate: z.date().optional(),
  targetTime: z.string(),
  templateProjectId: z.string(),
});

type FormInputs = z.infer<typeof formSchema>;

export type CreatedProject = {
  id: string;
  slug: string;
  organization?: { id: string; slug: string } | null;
};

export type CreateProjectModalPropTypes = {
  organizationId: string;
  categories: CategoryFragment[];
  /** A category id or "uncategorized". Unset picks the default category. */
  initialCategoryId?: string;
  onCreated?: (project: CreatedProject) => Promise<void> | void;
};

const UNCATEGORIZED = "uncategorized";
const BLANK = "blank";

const categoryDefaults = (category?: CategoryFragment) => ({
  targetDate: (category && categoryNextDate(category)) ?? undefined,
  targetTime: category?.startTime ? formatCategoryTime(category.startTime) : "",
  templateProjectId: category?.templateProjectId ?? BLANK,
});

const CreateProjectModal = ({
  organizationId,
  categories,
  initialCategoryId,
  onCreated,
}: CreateProjectModalPropTypes) => {
  const labels = getOrgTypeLabels(useOrganizationType());
  const { isOpen, onToggle, resetData } = useOverlayToggle();

  const [, createProject] = useCreateProjectMutation();
  const slug = useOrganizationSlug();

  const namePlaceholder = useMemo(() => untitledProjectName(new Date()), []);

  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const { allTagByOrganization, refetch: refetchTags } =
    globalState.modelDataAccess.useTag();
  const [, createTag] = useCreateTagMutation();

  const initialCategory = initialCategoryId
    ? categories.find((c) => c.id === initialCategoryId)
    : categories.find((c) => c.isDefault);
  const form = useForm<FormInputs>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      categoryId: initialCategory?.id ?? UNCATEGORIZED,
      ...categoryDefaults(initialCategory),
    },
  });

  const categoryId = useWatch({ control: form.control, name: "categoryId" });
  const targetDate = useWatch({ control: form.control, name: "targetDate" });
  const selectedCategory = categories.find((c) => c.id === categoryId);

  // Follow the category's defaults until the user picks a date/time themselves
  const dateTouched = useRef(false);
  const lastCategoryId = useRef(categoryId);
  useEffect(() => {
    if (lastCategoryId.current === categoryId) return;
    lastCategoryId.current = categoryId;
    const defaults = categoryDefaults(selectedCategory);
    if (!dateTouched.current) {
      form.setValue("targetDate", defaults.targetDate);
      form.setValue("targetTime", defaults.targetTime);
    }
    form.setValue("templateProjectId", defaults.templateProjectId);
  }, [categoryId, selectedCategory, form]);

  const handleSubmit = useCallback(
    (data: FormInputs) => {
      createProject({
        organizationId,
        slug: generateSlug(),
        name: data.name ?? "",
        categoryId:
          data.categoryId === UNCATEGORIZED ? undefined : data.categoryId,
        tags: selectedTagIds,
        targetDate: data.targetDate
          ? toProjectDateValue(data.targetDate)
          : null,
        targetTime: data.targetDate
          ? toProjectTimeValue(data.targetTime)
          : null,
        templateProjectId:
          data.templateProjectId === BLANK ? null : data.templateProjectId,
      }).then(async (x) => {
        const project = x?.createFullProject?.project;
        if (!project) return;

        if (onCreated) {
          try {
            await onCreated(project);
          } catch (e) {
            logger.error("CreateProjectModal onCreated failed:", e);
          }
        }

        captureEvent("project_created", {
          has_name: data.name !== "",
          has_category: data.categoryId !== UNCATEGORIZED,
          tag_count: selectedTagIds.length,
          has_target_date: Boolean(data.targetDate),
          has_target_time: Boolean(data.targetDate) && data.targetTime !== "",
          from_template: data.templateProjectId !== BLANK,
        });

        const projectSlug = project.slug;
        const projectOrgSlug = project.organization?.slug ?? slug;

        window.location.href = `/app/${projectOrgSlug}/${projectSlug}`;
      });

      onToggle?.();
      resetData?.();
    },
    [
      createProject,
      onToggle,
      organizationId,
      resetData,
      selectedTagIds,
      slug,
      onCreated,
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
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <InputControl
              control={form.control}
              name="name"
              label="Name"
              placeholder={namePlaceholder}
            />

            <SelectControl
              control={form.control}
              name="categoryId"
              label="Category"
              options={[
                { label: "Uncategorized", value: UNCATEGORIZED },
              ].concat(categories.map((x) => ({ label: x.name, value: x.id })))}
            />

            <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
              <FormField
                control={form.control}
                name="targetDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{labels.projectDate}</FormLabel>
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
                          dateTouched.current = true;
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
              <TimeInputControl
                control={form.control}
                name="targetTime"
                label="Time"
                disabled={!targetDate}
                className="w-32"
                onChange={() => {
                  dateTouched.current = true;
                }}
              />
            </div>

            {selectedCategory?.templateProject && (
              <SelectControl
                control={form.control}
                name="templateProjectId"
                label="Start from"
                options={[
                  {
                    label: projectTitle(selectedCategory.templateProject),
                    value: selectedCategory.templateProject.id,
                  },
                  { label: "Blank project", value: BLANK },
                ]}
              />
            )}

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
            <div className="flex gap-2">
              <Button type="submit" variant="success">
                Save
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

export default CreateProjectModal;
