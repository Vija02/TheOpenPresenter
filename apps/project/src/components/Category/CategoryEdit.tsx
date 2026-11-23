import { zodResolver } from "@hookform/resolvers/zod";
import { CategoryFragment } from "@repo/graphql";
import {
  CategoryCadence,
  WEEKDAYS_FROM_MONDAY,
  WEEKDAY_NAMES,
  WEEK_OF_MONTH_NAMES,
  WeekOfMonth,
  Weekday,
  categoryEndsAt,
  describeCadence,
  extractError,
  formatCadence,
  formatCategoryTime,
  fromDateValue,
  nextOccurrence,
  nextOccurrences,
  nextPeriodStarts,
  parseCadence,
  projectTitle,
  toDateValue,
} from "@repo/lib";
import {
  Alert,
  Button,
  CheckboxControl,
  DialogTitle,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  InputControl,
  NumberInput,
  PopConfirm,
  Select,
  SelectControl,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TimeInputControl,
} from "@repo/ui";
import { format } from "date-fns";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { CombinedError } from "urql";
import { z } from "zod";

import "./CategoryEdit.css";

export type CategoryValues = {
  name: string;
  showInFilter: boolean;
  isDefault: boolean;
  recurrence: string | null;
  recurrenceAnchor: string | null;
  startTime: string | null;
  durationMinutes: number | null;
  templateProjectId: string | null;
};

export type TemplateProjectOption = {
  id: string;
  name: string;
  createdAt: string;
  targetDate?: string | null;
  category?: { id: string } | null;
};

export type CategoryEditPropTypes = {
  initialCategory?: Partial<CategoryFragment>;
  projects: TemplateProjectOption[];
  onCreate: (category: CategoryValues) => Promise<any>;
  onCancel: () => void;
  onDelete?: () => void;
  error: CombinedError | null;
  title: string;
  /** Names of the org's other categories, for numbering unnamed ones */
  takenNames?: string[];
  submitText?: string;
};

const BLANK = "blank";

const formSchema = z
  .object({
    name: z.string(),
    showInFilter: z.boolean(),
    isDefault: z.boolean(),
    repeats: z.boolean(),
    advanced: z.boolean(),
    unit: z.enum(["week", "month", "custom"]),
    interval: z.number({ error: "Enter a number" }).int().min(1).max(99),
    weekdays: z.array(z.number()),
    week: z.number(),
    monthWeekday: z.number(),
    anchor: z.string().nullable(),
    startTime: z.string(),
    durationMinutes: z.number().nullable(),
    templateProjectId: z.string(),
  })
  .refine((v) => !v.repeats || v.unit !== "week" || v.weekdays.length > 0, {
    message: "Pick at least one day",
    path: ["weekdays"],
  });
type FormInputs = z.infer<typeof formSchema>;

type Section = "general" | "schedule" | "template";
const SECTIONS: {
  value: Section;
  label: string;
  fields: (keyof FormInputs)[];
}[] = [
  {
    value: "general",
    label: "General",
    fields: ["name", "showInFilter", "isDefault"],
  },
  {
    value: "schedule",
    label: "Schedule",
    fields: [
      "repeats",
      "advanced",
      "unit",
      "interval",
      "weekdays",
      "week",
      "monthWeekday",
      "anchor",
      "startTime",
      "durationMinutes",
    ],
  },
  { value: "template", label: "Template", fields: ["templateProjectId"] },
];

const SCHEDULE_OPTIONS = [
  { label: "Doesn't repeat", value: "none" },
  ...([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((d) => ({
    label: `Every ${WEEKDAY_NAMES[d]}`,
    value: `day:${d}`,
  })),
  { label: "Custom…", value: "custom" },
];

const UNNAMED = "Unnamed category";
const unnamedCategory = (taken: string[]) => {
  let name = UNNAMED;
  for (let i = 2; taken.includes(name); i++) name = `${UNNAMED} ${i}`;
  return name;
};

const DURATIONS = [30, 45, 60, 75, 90, 120, 150, 180];
const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h > 0 && `${h}h`, m > 0 && `${m}m`].filter(Boolean).join(" ");
};

const toCadence = (v: FormInputs): CategoryCadence | null => {
  if (!v.repeats) return null;
  const interval =
    Number.isInteger(v.interval) && v.interval > 0 ? v.interval : 1;
  if (v.unit === "week" && v.weekdays.length > 0) {
    return { kind: "weekly", interval, weekdays: v.weekdays as Weekday[] };
  }
  if (v.unit === "month") {
    return {
      kind: "monthly",
      interval,
      week: v.week as WeekOfMonth,
      weekday: v.monthWeekday as Weekday,
    };
  }
  return null;
};

const toFormInputs = (category: Partial<CategoryFragment>): FormInputs => {
  const cadence = parseCadence(category.recurrence);
  // New categories start as every Sunday at 10:00
  const repeats = category.id ? !!category.recurrence : true;
  const simple =
    cadence?.kind === "weekly" &&
    cadence.interval === 1 &&
    cadence.weekdays.length === 1;
  return {
    name: category.name ?? "",
    showInFilter: category.showInFilter ?? true,
    isDefault: category.isDefault ?? false,
    repeats,
    advanced: !!category.recurrence && !simple,
    unit: cadence
      ? cadence.kind === "weekly"
        ? "week"
        : "month"
      : category.recurrence
        ? "custom"
        : "week",
    interval: cadence?.interval ?? 1,
    weekdays: cadence?.kind === "weekly" ? cadence.weekdays : [0],
    week: cadence?.kind === "monthly" ? cadence.week : 1,
    monthWeekday: cadence?.kind === "monthly" ? cadence.weekday : 0,
    anchor: category.recurrenceAnchor ?? null,
    startTime: category.startTime
      ? formatCategoryTime(category.startTime)
      : category.id
        ? ""
        : "10:00",
    durationMinutes: category.durationMinutes ?? null,
    templateProjectId: category.templateProjectId ?? BLANK,
  };
};

const WeekdayPicker = ({
  value,
  onChange,
  multiple,
}: {
  value: number[];
  onChange: (value: number[]) => void;
  multiple: boolean;
}) => (
  <div className="flex gap-1.5" role="group" aria-label="Repeat on">
    {WEEKDAYS_FROM_MONDAY.map((day) => {
      const selected = value.includes(day);
      return (
        <button
          key={day}
          type="button"
          aria-label={WEEKDAY_NAMES[day]}
          aria-pressed={selected}
          className={
            "size-8 rounded-full text-xs font-medium transition-colors " +
            (selected
              ? "bg-fill-default text-fill-default-fg"
              : "bg-surface-secondary text-secondary hover:bg-surface-primary-hover")
          }
          onClick={() => {
            if (!multiple) return onChange([day]);
            onChange(
              selected ? value.filter((d) => d !== day) : [...value, day],
            );
          }}
        >
          {WEEKDAY_NAMES[day][0]}
        </button>
      );
    })}
  </div>
);

export function CategoryEdit({
  initialCategory = {},
  projects,
  onCreate,
  onCancel,
  onDelete,
  error,
  title,
  takenNames = [],
  submitText = "Create",
}: CategoryEditPropTypes) {
  const form = useForm<FormInputs>({
    resolver: zodResolver(formSchema),
    defaultValues: toFormInputs(initialCategory),
  });
  const values = useWatch({ control: form.control }) as FormInputs;
  const cadence = toCadence(values);
  const cadenceKey = cadence ? formatCadence(cadence) : null;

  // Skip today once today's occurrence is over, as the preview does
  const endsAt = categoryEndsAt(values.startTime, values.durationMinutes);
  const anchorOptions = useMemo(() => {
    if (!cadence || cadence.interval < 2) return [];
    return nextPeriodStarts(cadence, undefined, endsAt).map((d) => ({
      value: toDateValue(d),
      label: format(d, "EEE d MMM yyyy"),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cadenceKey, endsAt]);

  const anchor = useMemo(() => {
    if (!cadence || anchorOptions.length === 0) return null;
    if (!values.anchor) return anchorOptions[0]!.value;
    // Keep a saved anchor's phase, shown as its next occurrence
    const next = nextOccurrence(cadence, {
      anchor: fromDateValue(values.anchor),
      endsAt,
    });
    const value = next ? toDateValue(next) : null;
    return anchorOptions.some((o) => o.value === value)
      ? value
      : anchorOptions[0]!.value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorOptions, values.anchor, cadenceKey, endsAt]);

  useEffect(() => {
    if (values.unit !== "custom" && anchor !== values.anchor) {
      form.setValue("anchor", anchor);
    }
  }, [anchor, values.anchor, values.unit, form]);

  const preview = useMemo(
    () =>
      cadence
        ? nextOccurrences(cadence, {
            anchor: anchor ? fromDateValue(anchor) : null,
            count: 3,
            endsAt,
          })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cadenceKey, anchor, endsAt],
  );

  const projectOptions = useMemo(() => {
    const own = projects.filter(
      (p) => initialCategory.id && p.category?.id === initialCategory.id,
    );
    const rest = projects.filter((p) => !own.includes(p));
    // The current one may be older than the projects we loaded
    const current = initialCategory.templateProject;
    if (current && !projects.some((p) => p.id === current.id)) {
      own.unshift(current);
    }
    return [
      { label: "Blank project", value: BLANK },
      ...[...own, ...rest].map((p) => ({
        label: projectTitle(p),
        value: p.id,
      })),
    ];
  }, [projects, initialCategory.id, initialCategory.templateProject]);

  const handleCreate = useCallback(
    async (v: FormInputs) => {
      const c = toCadence(v);
      const custom = v.repeats && v.unit === "custom";
      await onCreate({
        name: v.name.trim() || unnamedCategory(takenNames),
        showInFilter: v.showInFilter,
        isDefault: v.isDefault,
        recurrence: custom
          ? (initialCategory.recurrence ?? null)
          : c
            ? formatCadence(c)
            : null,
        recurrenceAnchor: custom ? v.anchor : anchor,
        startTime: v.repeats && v.startTime ? v.startTime : null,
        durationMinutes: v.repeats ? v.durationMinutes : null,
        templateProjectId:
          v.templateProjectId === BLANK ? null : v.templateProjectId,
      });
    },
    [onCreate, anchor, initialCategory.recurrence, takenNames],
  );

  // Creating walks through the sections one step at a time
  const steps = !initialCategory.id;
  const [section, setSection] = useState<Section | "delete">("general");
  const [reached, setReached] = useState(0);
  const index = SECTIONS.findIndex((s) => s.value === section);
  const isLast = index === SECTIONS.length - 1;

  const goNext = async () => {
    if (!(await form.trigger(SECTIONS[index]!.fields))) return;
    setSection(SECTIONS[index + 1]!.value);
    setReached((r) => Math.max(r, index + 1));
  };

  const onSubmit = (e: FormEvent) => {
    if (steps && !isLast) {
      e.preventDefault();
      void goNext();
      return;
    }
    return form.handleSubmit(handleCreate, (errors) => {
      const withError = SECTIONS.find((s) => s.fields.some((f) => f in errors));
      if (withError) setSection(withError.value);
    })(e);
  };

  const schedule = !values.repeats
    ? "none"
    : values.advanced
      ? "custom"
      : `day:${values.weekdays[0] ?? 0}`;
  const pickSchedule = (value: string) => {
    const opts = { shouldDirty: true };
    form.setValue("repeats", value !== "none", opts);
    form.setValue("advanced", value === "custom", opts);
    if (value.startsWith("day:")) {
      form.setValue("unit", "week", opts);
      form.setValue("interval", 1, opts);
      form.setValue("weekdays", [Number(value.slice(4))], opts);
    }
  };

  const plural = values.interval > 1 ? "s" : "";
  const unitOptions = [
    { label: `week${plural}`, value: "week" },
    { label: `month${plural}`, value: "month" },
    ...(values.unit === "custom" ? [{ label: "Custom", value: "custom" }] : []),
  ];
  const repeats = values.unit === "week" || values.unit === "month";

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="h-full min-h-0">
        <Tabs
          value={section}
          onValueChange={(v) => setSection(v as Section | "delete")}
          orientation="vertical"
          className="project--category-edit"
        >
          <DialogTitle className="project--category-edit__title">
            {title}
          </DialogTitle>
          <div className="project--category-edit__body">
            <div className="project--category-edit__sidebar">
              <TabsList
                aria-label="Category settings"
                className="project--category-edit__nav"
              >
                {SECTIONS.map((s, i) => (
                  <TabsTrigger
                    key={s.value}
                    value={s.value}
                    disabled={steps && i > reached}
                    className="project--category-edit__tab"
                  >
                    {steps && (
                      <span className="project--category-edit__step">
                        {i + 1}
                      </span>
                    )}
                    {s.label}
                  </TabsTrigger>
                ))}
                {onDelete && (
                  <TabsTrigger
                    value="delete"
                    className="project--category-edit__tab project--category-edit__tab--danger"
                  >
                    Delete
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            <div className="project--category-edit__main">
              <div className="project--category-edit__content">
                <TabsContent
                  value="general"
                  className="stack-col items-stretch gap-5"
                >
                  <InputControl
                    control={form.control}
                    name="name"
                    label="Name"
                    placeholder={UNNAMED}
                    autoFocus={steps}
                  />

                  <CheckboxControl
                    control={form.control}
                    name="showInFilter"
                    label="Show in filter"
                    description="Untick for occasional events."
                  />

                  <CheckboxControl
                    control={form.control}
                    name="isDefault"
                    label="Use as default"
                    description="New projects start in this category when none is picked."
                  />
                </TabsContent>

                <TabsContent
                  value="schedule"
                  className="stack-col items-stretch gap-4"
                >
                  <FormField
                    control={form.control}
                    name="repeats"
                    render={() => (
                      <FormItem data-testid="form-item-schedule">
                        <FormLabel>Repeats</FormLabel>
                        <FormControl>
                          <Select
                            aria-label="Repeats"
                            options={SCHEDULE_OPTIONS}
                            value={
                              SCHEDULE_OPTIONS.find(
                                (o) => o.value === schedule,
                              ) ?? null
                            }
                            onChange={(o) => o && pickSchedule(o.value)}
                            isSearchable={false}
                          />
                        </FormControl>
                        <FormDescription>
                          Fills in the date and time of new projects
                          automatically.
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  {values.repeats && (
                    <>
                      {values.advanced && (
                        <>
                          <div className="stack-col items-stretch gap-2">
                            <FormLabel>
                              {repeats ? "Repeat every" : "Repeats"}
                            </FormLabel>
                            <div className="flex items-start gap-2">
                              {repeats && (
                                <FormField
                                  control={form.control}
                                  name="interval"
                                  render={({ field }) => (
                                    <FormItem className="w-20">
                                      <FormControl>
                                        <NumberInput
                                          aria-label="Repeat every"
                                          value={field.value}
                                          onChange={(v) => field.onChange(v)}
                                          min={1}
                                          max={99}
                                          precision={0}
                                          clampValueOnBlur
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              )}
                              <FormField
                                control={form.control}
                                name="unit"
                                render={({ field }) => (
                                  <FormItem
                                    className="w-44"
                                    data-testid="form-item-unit"
                                  >
                                    <FormControl>
                                      <Select
                                        aria-label="Repeat unit"
                                        options={unitOptions}
                                        value={
                                          unitOptions.find(
                                            (o) => o.value === field.value,
                                          ) ?? null
                                        }
                                        onChange={(o) =>
                                          o && field.onChange(o.value)
                                        }
                                        isSearchable={false}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>

                          {values.unit === "week" && (
                            <FormField
                              control={form.control}
                              name="weekdays"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Repeat on</FormLabel>
                                  <WeekdayPicker
                                    value={field.value}
                                    onChange={field.onChange}
                                    multiple
                                  />
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}

                          {values.unit === "month" && (
                            <div className="stack-col items-stretch gap-2">
                              <FormLabel>Repeat on</FormLabel>
                              <div className="flex flex-wrap items-center gap-2">
                                <FormField
                                  control={form.control}
                                  name="week"
                                  render={({ field }) => {
                                    const options = (
                                      [1, 2, 3, 4, -1] as WeekOfMonth[]
                                    ).map((w) => ({
                                      label: WEEK_OF_MONTH_NAMES[w],
                                      value: w,
                                    }));
                                    return (
                                      <FormItem
                                        className="w-32"
                                        data-testid="form-item-week"
                                      >
                                        <FormControl>
                                          <Select
                                            aria-label="Which week"
                                            options={options}
                                            value={
                                              options.find(
                                                (o) => o.value === field.value,
                                              ) ?? null
                                            }
                                            onChange={(o) =>
                                              o && field.onChange(o.value)
                                            }
                                            isSearchable={false}
                                          />
                                        </FormControl>
                                      </FormItem>
                                    );
                                  }}
                                />
                                <FormField
                                  control={form.control}
                                  name="monthWeekday"
                                  render={({ field }) => (
                                    <WeekdayPicker
                                      value={[field.value]}
                                      onChange={(v) => field.onChange(v[0])}
                                      multiple={false}
                                    />
                                  )}
                                />
                              </div>
                            </div>
                          )}

                          {anchorOptions.length > 0 && (
                            <div className="sm:w-1/2">
                              <SelectControl
                                control={form.control}
                                name="anchor"
                                label="Next one is on"
                                options={anchorOptions}
                                isSearchable={false}
                              />
                            </div>
                          )}
                        </>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <TimeInputControl
                          control={form.control}
                          name="startTime"
                          label="Starts at"
                        />
                        <SelectControl
                          control={form.control}
                          name="durationMinutes"
                          label="Usually lasts"
                          isClearable
                          placeholder="Not set"
                          options={[
                            ...new Set(
                              [...DURATIONS, values.durationMinutes].filter(
                                (x): x is number => x != null && x > 0,
                              ),
                            ),
                          ]
                            .sort((a, b) => a - b)
                            .map((m) => ({
                              label: formatDuration(m),
                              value: m,
                            }))}
                        />
                      </div>

                      {cadence && preview.length > 0 && (
                        <p className="text-sm text-secondary">
                          {describeCadence(cadence)}
                          {values.startTime ? ` at ${values.startTime}` : ""}.
                          Next:{" "}
                          {preview
                            .map((d) => format(d, "EEE d MMM"))
                            .join(", ")}
                        </p>
                      )}
                      {values.unit === "custom" && (
                        <p className="text-sm text-secondary">
                          This category uses a custom schedule (
                          <code>{initialCategory.recurrence}</code>) that can't
                          be edited here.
                        </p>
                      )}
                    </>
                  )}
                </TabsContent>

                <TabsContent
                  value="template"
                  className="stack-col items-stretch gap-3"
                >
                  <SelectControl
                    control={form.control}
                    name="templateProjectId"
                    label="Start from"
                    description="New projects in this category start as a copy of this project."
                    options={projectOptions}
                  />
                </TabsContent>

                {onDelete && (
                  <TabsContent
                    value="delete"
                    className="stack-col items-start gap-3"
                  >
                    <p className="text-sm text-secondary">
                      Projects in this category are kept, but lose their
                      category. This can't be undone.
                    </p>
                    <PopConfirm
                      title="Delete this category?"
                      description="Projects in it are kept, but lose their category."
                      okText="Delete"
                      cancelText="Cancel"
                      onConfirm={onDelete}
                    >
                      <Button variant="destructive">Delete category</Button>
                    </PopConfirm>
                  </TabsContent>
                )}

                {error ? (
                  <Alert
                    variant="destructive"
                    title="Error performing this operation"
                  >
                    {extractError(error).message}
                  </Alert>
                ) : null}
              </div>

              <div className="project--category-edit__footer">
                {steps && index > 0 ? (
                  <Button
                    variant="outline"
                    className="ml-auto"
                    onClick={() => setSection(SECTIONS[index - 1]!.value)}
                  >
                    Back
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="ml-auto"
                    onClick={onCancel}
                  >
                    Cancel
                  </Button>
                )}
                {/* Keyed so Next never becomes the submit button mid-click */}
                {steps && !isLast ? (
                  <Button key="next" variant="success" onClick={goNext}>
                    Next
                  </Button>
                ) : (
                  <Button
                    key="submit"
                    variant="success"
                    type="submit"
                    isLoading={form.formState.isSubmitting}
                  >
                    {submitText}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Tabs>
      </form>
    </Form>
  );
}
