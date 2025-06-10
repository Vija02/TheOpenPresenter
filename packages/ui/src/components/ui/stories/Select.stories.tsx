import { zodResolver } from "@hookform/resolvers/zod";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../button";
import { Form } from "../form";
import { type OptionType, Select, SelectControl } from "../select";

// Sample options for stories
const basicOptions: OptionType[] = [
  { label: "Apple", value: "apple" },
  { label: "Banana", value: "banana" },
  { label: "Cherry", value: "cherry" },
  { label: "Date", value: "date" },
  { label: "Elderberry", value: "elderberry" },
  { label: "Fig", value: "fig" },
  { label: "Grape", value: "grape" },
  { label: "Honeydew", value: "honeydew" },
];

const countryOptions: OptionType[] = [
  { label: "United States", value: "us" },
  { label: "United Kingdom", value: "uk" },
  { label: "Canada", value: "ca" },
  { label: "Australia", value: "au" },
  { label: "Germany", value: "de" },
  { label: "France", value: "fr" },
  { label: "Japan", value: "jp" },
  { label: "Brazil", value: "br" },
  { label: "India", value: "in" },
  { label: "China", value: "cn" },
];

const groupedOptions = [
  {
    label: "Fruits",
    options: [
      { label: "Apple", value: "apple" },
      { label: "Banana", value: "banana" },
      { label: "Cherry", value: "cherry" },
    ],
  },
  {
    label: "Vegetables",
    options: [
      { label: "Carrot", value: "carrot" },
      { label: "Broccoli", value: "broccoli" },
      { label: "Spinach", value: "spinach" },
    ],
  },
];

const meta = {
  title: "Primitive/Select",
  component: Select,
  tags: ["autodocs"],
  argTypes: {
    isMulti: {
      control: "boolean",
      description: "Enable multi-select functionality",
    },
    isDisabled: {
      control: "boolean",
      description: "Disable the select component",
    },
    isClearable: {
      control: "boolean",
      description: "Allow clearing the selected value",
    },
    isSearchable: {
      control: "boolean",
      description: "Enable search functionality",
    },
    isLoading: {
      control: "boolean",
      description: "Show loading state",
    },
    placeholder: {
      control: "text",
      description: "Placeholder text when no option is selected",
    },
  },
  args: {
    options: basicOptions,
    onChange: fn(),
    placeholder: "Select an option...",
    isSearchable: true,
    isClearable: false,
    isDisabled: false,
    isLoading: false,
    isMulti: false,
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const WithDefaultValue: Story = {
  args: {
    defaultValue: basicOptions[0],
  },
};

export const MultiSelect: Story = {
  args: {
    isMulti: true,
    placeholder: "Select multiple options...",
    defaultValue: [basicOptions[0], basicOptions[2]],
  },
};

export const Clearable: Story = {
  args: {
    isClearable: true,
    defaultValue: basicOptions[1],
  },
};

export const Disabled: Story = {
  args: {
    isDisabled: true,
    defaultValue: basicOptions[0],
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
    placeholder: "Loading options...",
  },
};

export const NotSearchable: Story = {
  args: {
    isSearchable: false,
    placeholder: "Select (not searchable)...",
  },
};

export const WithManyOptions: Story = {
  args: {
    options: countryOptions,
    placeholder: "Select a country...",
  },
};

export const GroupedOptions: Story = {
  args: {
    options: groupedOptions,
    placeholder: "Select from groups...",
  },
};

export const MultiSelectClearable: Story = {
  args: {
    isMulti: true,
    isClearable: true,
    placeholder: "Select multiple (clearable)...",
    defaultValue: [basicOptions[0], basicOptions[1], basicOptions[2]],
  },
};

export const CustomWidth: Story = {
  args: {
    placeholder: "Custom width select...",
  },
  render: (args) => {
    return (
      <div style={{ width: "300px" }}>
        <Select {...args} />
      </div>
    );
  },
};

export const InForm: Story = {
  render: () => {
    const formSchema = z.object({
      favoriteFruit: z.string().min(1, "Please select a fruit"),
      multipleFruits: z
        .array(z.string())
        .min(1, "Please select at least one fruit"),
    });

    const form = useForm<z.infer<typeof formSchema>>({
      resolver: zodResolver(formSchema),
      defaultValues: {
        favoriteFruit: "",
        multipleFruits: [],
      },
    });

    const onSubmit = (values: z.infer<typeof formSchema>) => {
      console.log("Form submitted:", values);
      alert(
        `Selected: ${values.favoriteFruit}, Multiple: ${values.multipleFruits.join(", ")}`,
      );
    };

    return (
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4 max-w-md"
        >
          <SelectControl
            control={form.control}
            name="favoriteFruit"
            label="Favorite Fruit"
            description="Choose your favorite fruit from the list"
            options={basicOptions}
            placeholder="Select your preference..."
          />

          <SelectControl
            control={form.control}
            name="multipleFruits"
            label="Multiple Fruits"
            description="You can select multiple fruits"
            options={basicOptions}
            placeholder="Select multiple fruits..."
            isMulti
            isClearable
          />

          <Button type="submit">Submit</Button>
        </form>
      </Form>
    );
  },
};

export const ErrorState: Story = {
  render: () => {
    const formSchema = z.object({
      requiredField: z.string().min(1, "This field is required"),
      optionalField: z.string().optional(),
    });

    const form = useForm<z.infer<typeof formSchema>>({
      resolver: zodResolver(formSchema),
      defaultValues: {
        requiredField: "",
        optionalField: "",
      },
    });

    const data = form.watch();

    // Trigger validation to show error state
    useEffect(() => {
      form.trigger();
    }, [form, data]);

    const onSubmit = (values: z.infer<typeof formSchema>) => {
      console.log("Form submitted:", values);
      alert(`Form data: ${JSON.stringify(values, null, 2)}`);
    };

    return (
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4 max-w-md"
        >
          <SelectControl
            control={form.control}
            name="requiredField"
            label="Required Selection"
            description="This field must be filled"
            options={basicOptions}
            placeholder="Select an option..."
          />

          <SelectControl
            control={form.control}
            name="optionalField"
            label="Optional Selection"
            description="This field is optional"
            options={countryOptions}
            placeholder="Select a country (optional)..."
          />

          <Button type="submit">Submit</Button>
        </form>
      </Form>
    );
  },
};

export const FormWithValidation: Story = {
  render: () => {
    const formSchema = z.object({
      category: z.string().min(1, "Category is required"),
      tags: z.array(z.string()).min(2, "Please select at least 2 tags"),
      priority: z.string().min(1, "Priority is required"),
    });

    const form = useForm<z.infer<typeof formSchema>>({
      resolver: zodResolver(formSchema),
      defaultValues: {
        category: "",
        tags: [],
        priority: "",
      },
    });

    const onSubmit = (values: z.infer<typeof formSchema>) => {
      console.log("Form submitted:", values);
      alert(`Form data: ${JSON.stringify(values, null, 2)}`);
    };

    const categoryOptions: OptionType[] = [
      { label: "Technology", value: "tech" },
      { label: "Design", value: "design" },
      { label: "Marketing", value: "marketing" },
      { label: "Sales", value: "sales" },
    ];

    const tagOptions: OptionType[] = [
      { label: "React", value: "react" },
      { label: "TypeScript", value: "typescript" },
      { label: "Node.js", value: "nodejs" },
      { label: "GraphQL", value: "graphql" },
      { label: "PostgreSQL", value: "postgresql" },
      { label: "Docker", value: "docker" },
    ];

    const priorityOptions: OptionType[] = [
      { label: "Low", value: "low" },
      { label: "Medium", value: "medium" },
      { label: "High", value: "high" },
      { label: "Critical", value: "critical" },
    ];

    return (
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6 max-w-md"
        >
          <SelectControl
            control={form.control}
            name="category"
            label="Project Category"
            description="Select the main category for this project"
            options={categoryOptions}
            placeholder="Choose a category..."
          />

          <SelectControl
            control={form.control}
            name="tags"
            label="Technology Tags"
            description="Select at least 2 technologies used in this project"
            options={tagOptions}
            placeholder="Select technologies..."
            isMulti
            isClearable
          />

          <SelectControl
            control={form.control}
            name="priority"
            label="Priority Level"
            description="Set the priority level for this project"
            options={priorityOptions}
            placeholder="Select priority..."
          />

          <div className="flex gap-2">
            <Button type="submit">Create Project</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset()}
            >
              Reset
            </Button>
          </div>
        </form>
      </Form>
    );
  },
};

export const DisabledFormField: Story = {
  render: () => {
    const formSchema = z.object({
      enabledField: z.string().min(1, "This field is required"),
      disabledField: z.string().optional(),
    });

    const form = useForm<z.infer<typeof formSchema>>({
      resolver: zodResolver(formSchema),
      defaultValues: {
        enabledField: "",
        disabledField: "preset-value",
      },
    });

    const onSubmit = (values: z.infer<typeof formSchema>) => {
      console.log("Form submitted:", values);
      alert(`Form data: ${JSON.stringify(values, null, 2)}`);
    };

    return (
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4 max-w-md"
        >
          <SelectControl
            control={form.control}
            name="enabledField"
            label="Enabled Field"
            description="This field is interactive"
            options={basicOptions}
            placeholder="Select an option..."
          />

          <SelectControl
            control={form.control}
            name="disabledField"
            label="Disabled Field"
            description="This field is disabled with a preset value"
            options={basicOptions}
            placeholder="This is disabled..."
            isDisabled
          />

          <Button type="submit">Submit</Button>
        </form>
      </Form>
    );
  },
};
