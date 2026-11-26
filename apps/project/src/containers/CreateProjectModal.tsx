import { ReactSelectDateProps } from "@/components/DatePicker/datePickerReactSelect";
import { Tag } from "@/components/Tag";
import { TagsSelector } from "@/components/Tag/TagsSelector";
import {
  categoryNextDate,
  categoryScheduleLabel,
  noCategoryLabel,
} from "@/lib/categorySchedule";
import { getOrgTypeLabels } from "@/lib/organizationType";
import {
  useOrganizationSlug,
  useOrganizationType,
} from "@/lib/permissionHooks/organization";
import {
  formatTimeLabel,
  toProjectDateValue,
  toProjectTimeValue,
} from "@/lib/projectDate";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CategoryFragment,
  useCreateProjectMutation,
  useCreateTagMutation,
} from "@repo/graphql";
import { formatCategoryTime, globalState, projectTitle } from "@repo/lib";
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
  Label,
  OptionControl,
  Select,
  TimeInputControl,
  formatHumanReadableDate,
  useOverlayToggle,
} from "@repo/ui";
import { addDays, format } from "date-fns";
import { generateSlug } from "random-word-slugs";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { FiCalendar, FiPlus, FiSettings, FiTag } from "react-icons/fi";
import { toast } from "react-toastify";
import { z } from "zod";

import "./CreateProjectModal.css";

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

  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const { allTagByOrganization, refetch: refetchTags } =
    globalState.modelDataAccess.useTag();
  const selectedTags = selectedTagIds.flatMap(
    (id) => allTagByOrganization?.find((tag) => tag.id === id) ?? [],
  );
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
  const targetTime = useWatch({ control: form.control, name: "targetTime" });
  const selectedCategory = categories.find((c) => c.id === categoryId);

  // What the category filled in, shown as one line until the user wants to change it
  const [showDetails, setShowDetails] = useState(false);
  const [editingTags, setEditingTags] = useState(false);
  const summary =
    selectedCategory && targetDate
      ? format(targetDate, "EEE d MMM") +
        (targetTime ? ` at ${formatTimeLabel(targetTime)}` : "")
      : null;
  const detailsOpen = showDetails || !summary;

  // A blank name shows as the project's date, so preview exactly that
  const namePlaceholder = useMemo(
    () =>
      projectTitle({
        name: "",
        createdAt: new Date().toISOString(),
        targetDate: targetDate ? toProjectDateValue(targetDate) : null,
      }),
    [targetDate],
  );

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

  const { publish } = globalState.modelDataAccess.usePublishAPIChanges({
    token: "page",
  });
  // Blocks a second create (e.g. a double click) while one is in progress
  const creating = useRef(false);
  const [isCreating, setIsCreating] = useState(false);

  // Focusing on open pops up the keyboard on phones, hiding the categories
  const [canHover] = useState(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(hover: hover)").matches,
  );

  /** `stayOpen` is "Create another": keep the modal open for the next one */
  const submit = async (data: FormInputs, stayOpen: boolean) => {
    if (creating.current) return;
    creating.current = true;
    setIsCreating(true);
    try {
      await createAndContinue(data, stayOpen);
    } finally {
      creating.current = false;
      setIsCreating(false);
    }
  };

  const createAndContinue = async (data: FormInputs, stayOpen: boolean) => {
    const targetDateValue = data.targetDate
      ? toProjectDateValue(data.targetDate)
      : null;
    const request = createProject({
      organizationId,
      slug: generateSlug(),
      name: data.name ?? "",
      categoryId:
        data.categoryId === UNCATEGORIZED ? undefined : data.categoryId,
      tags: selectedTagIds,
      targetDate: targetDateValue,
      targetTime: data.targetDate ? toProjectTimeValue(data.targetTime) : null,
      templateProjectId:
        data.templateProjectId === BLANK ? null : data.templateProjectId,
    });

    if (!stayOpen) {
      onToggle?.();
      resetData?.();
    }

    let project;
    try {
      project = (await request)?.createFullProject?.project;
    } catch (e) {
      logger.error("CreateProjectModal create failed:", e);
    }
    if (!project) {
      if (stayOpen) toast.error("Couldn't create the project");
      return;
    }

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
      create_another: stayOpen,
    });

    if (stayOpen) {
      publish();
      toast.success(
        `Created ${projectTitle({
          name: data.name ?? "",
          createdAt: new Date().toISOString(),
          targetDate: targetDateValue,
        })}`,
      );
      // Ready for the next one: same category, moved on to its next date
      form.setValue("name", "");
      if (!dateTouched.current && selectedCategory && data.targetDate) {
        const next = categoryNextDate(
          selectedCategory,
          addDays(data.targetDate, 1),
        );
        if (next) form.setValue("targetDate", next);
      }
      if (canHover) form.setFocus("name");
      return;
    }

    const projectOrgSlug = project.organization?.slug ?? slug;
    window.location.href = `/app/${projectOrgSlug}/${project.slug}`;
  };

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle}>
      <Form {...form}>
        {/* The name field focuses itself */}
        <DialogContent
          className="max-w-2xl"
          initialFocus={false}
          render={
            <form onSubmit={form.handleSubmit((data) => submit(data, false))} />
          }
        >
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {categories.length > 0 && (
              <div className="project--create-category">
                <div className="project--create-category-heading">
                  <Label>Category</Label>
                  <a
                    href={`/o/${slug}/settings/categories`}
                    target="_blank"
                    rel="noreferrer"
                    className="project--create-category-settings"
                    aria-label="Category settings"
                    title="Category settings"
                  >
                    <FiSettings />
                  </a>
                </div>
                <OptionControl
                  control={form.control}
                  name="categoryId"
                  aria-label="Category"
                  size="sm"
                  className="project--create-category-options"
                  options={[
                    ...categories.map((c) => ({
                      value: c.id,
                      title: c.name,
                      description: categoryScheduleLabel(c),
                    })),
                    {
                      value: UNCATEGORIZED,
                      title: noCategoryLabel(categories),
                    },
                  ]}
                />
              </div>
            )}

            <InputControl
              control={form.control}
              name="name"
              label="Name"
              placeholder={namePlaceholder}
              autoFocus={canHover}
            />

            {detailsOpen ? (
              <div className="grid gap-3 items-start sm:grid-cols-[1fr_auto]">
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
                  className="sm:w-32"
                  onChange={() => {
                    dateTouched.current = true;
                  }}
                />
              </div>
            ) : (
              <p
                className="project--create-summary"
                data-testid="create-project-summary"
              >
                <FiCalendar aria-hidden />
                <span>{summary}</span>
                <button
                  type="button"
                  className="project--create-link"
                  onClick={() => setShowDetails(true)}
                >
                  Change
                </button>
              </p>
            )}

            <div className="project--create-summary">
              <FiTag aria-hidden />
              {editingTags ? (
                <TagsSelector
                  inline
                  autoFocus
                  aria-label="Tags"
                  onBlur={() => setEditingTags(false)}
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
                  onCreateOption={async (optionName: string) => {
                    await createTag({
                      name: optionName,
                      organizationId: organizationId,
                    });
                    refetchTags?.();
                  }}
                />
              ) : (
                <>
                  {selectedTags.map((tag) => (
                    <Tag
                      key={tag.id}
                      tag={tag}
                      showRemove
                      onRemove={() =>
                        setSelectedTagIds((ids) =>
                          ids.filter((id) => id !== tag.id),
                        )
                      }
                    />
                  ))}
                  {selectedTags.length > 0 ? (
                    <button
                      type="button"
                      className="project--create-icon-button"
                      aria-label="Add tags"
                      title="Add tags"
                      onClick={() => setEditingTags(true)}
                    >
                      <FiPlus aria-hidden />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="project--create-link"
                      onClick={() => setEditingTags(true)}
                    >
                      <FiPlus aria-hidden />
                      Add tags
                    </button>
                  )}
                </>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <div className="flex w-full flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={onToggle}>
                Cancel
              </Button>
              {!onCreated && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isCreating}
                  onClick={form.handleSubmit((data) => submit(data, true))}
                >
                  Create another
                </Button>
              )}
              <Button type="submit" variant="success" disabled={isCreating}>
                Create
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Form>
    </Dialog>
  );
};

export default CreateProjectModal;
