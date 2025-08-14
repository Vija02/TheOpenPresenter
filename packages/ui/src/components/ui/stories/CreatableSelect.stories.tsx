import { zodResolver } from "@hookform/resolvers/zod";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../button";
import { Form } from "../form";
import { type OptionType } from "../select";
import { CreatableSelect, CreatableSelectControl } from "../creatableSelect";

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

const tagOptions: OptionType[] = [
  { label: "React", value: "react" },
  { label: "TypeScript", value: "typescript" },
  { label: "Node.js", value: "nodejs" },
  { label: "GraphQL", value: "graphql" },
  { label: "PostgreSQL", value: "postgresql" },
  { label: "Docker", value: "docker" },
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
  title: "Primitive/CreatableSelect",
  component: CreatableSelect,
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
    formatCreateLabel: {
      control: "text",
      description: "Custom format for create label",
    },
    allowCreateWhileLoading: {
      control: "boolean",
      description: "Allow creating new options while loading",
    },
    createOptionPosition: {
      control: { type: "select" },
      options: ["first", "last"],
      description: "Position of create option in menu",
    },
  },
  args: {
    options: basicOptions,
    onChange: fn(),
    onCreateOption: fn(),
    placeholder: "Select or create an option...",
    isSearchable: true,
    isClearable: false,
    isDisabled: false,
    isLoading: false,
    isMulti: false,
    allowCreateWhileLoading: false,
    createOptionPosition: "last",
  },
} satisfies Meta<typeof CreatableSelect>;

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
    placeholder: "Select or create multiple options...",
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
    placeholder: "Select or create a country...",
  },
};

export const GroupedOptions: Story = {
  args: {
    options: groupedOptions,
    placeholder: "Select or create from groups...",
  },
};

export const MultiSelectClearable: Story = {
  args: {
    isMulti: true,
    isClearable: true,
    placeholder: "Select or create multiple (clearable)...",
    defaultValue: [basicOptions[0], basicOptions[1], basicOptions[2]],
  },
};

export const CustomCreateLabel: Story = {
  args: {
    placeholder: "Type to create new tags...",
    formatCreateLabel: (inputValue: string) => `Add "${inputValue}" as new tag`,
    options: tagOptions,
  },
};

export const CreateOptionFirst: Story = {
  args: {
    placeholder: "Create option appears first...",
    createOptionPosition: "first",
    options: basicOptions,
  },
};

export const AllowCreateWhileLoading: Story = {
  args: {
    isLoading: true,
    allowCreateWhileLoading: true,
    placeholder: "Can create while loading...",
    options: basicOptions,
  },
};

export const TagCreation: Story = {
  args: {
    isMulti: true,
    placeholder: "Create and select tags...",
    options: tagOptions,
    formatCreateLabel: (inputValue: string) => `Create tag: ${inputValue}`,
  },
  render: (args) => {
    const [options, setOptions] = React.useState(tagOptions);
    
    const handleCreate = (inputValue: string) => {
      const newOption = { label: inputValue, value: inputValue.toLowerCase().replace(/\s+/g, '-') };
      setOptions(prev => [...prev, newOption]);
      return newOption;
    };

    return (
      <CreatableSelect
        {...args}
        options={options}
        onCreateOption={handleCreate}
      />
    );
  },
};

export const CustomWidth: Story = {
  args: {
    placeholder: "Custom width creatable select...",
  },
  render: (args) => {
    return (
      <div style={{ width: "300px" }}>
        <CreatableSelect {...args} />
      </div>
    );
  },
};

export const InForm: Story = {
  render: () => {
    const formSchema = z.object({
      favoriteFruit: z.string().min(1, "Please select or create a fruit"),
      multipleFruits: z
        .array(z.string())
        .min(1, "Please select or create at least one fruit"),
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
          <CreatableSelectControl
            control={form.control}
            name="favoriteFruit"
            label="Favorite Fruit"
            description="Choose or create your favorite fruit"
            options={basicOptions}
            placeholder="Select or create your preference..."
          />

          <CreatableSelectControl
            control={form.control}
            name="multipleFruits"
            label="Multiple Fruits"
            description="You can select or create multiple fruits"
            options={basicOptions}
            placeholder="Select or create multiple fruits..."
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
          <CreatableSelectControl
            control={form.control}
            name="requiredField"
            label="Required Selection"
            description="This field must be filled"
            options={basicOptions}
            placeholder="Select or create an option..."
          />

          <CreatableSelectControl
            control={form.control}
            name="optionalField"
            label="Optional Selection"
            description="This field is optional"
            options={countryOptions}
            placeholder="Select or create a country (optional)..."
          />

          <Button type="submit">Submit</Button>
        </form>
      </Form>
    );
  },
};

export const DynamicTagCreation: Story = {
  render: () => {
    const formSchema = z.object({
      skills: z.array(z.string()).min(1, "Please add at least one skill"),
      interests: z.array(z.string()).optional(),
    });

    const form = useForm<z.infer<typeof formSchema>>({
      resolver: zodResolver(formSchema),
      defaultValues: {
        skills: [],
        interests: [],
      },
    });

    const [skillOptions, setSkillOptions] = React.useState(tagOptions);
    const [interestOptions, setInterestOptions] = React.useState([
      { label: "Reading", value: "reading" },
      { label: "Gaming", value: "gaming" },
      { label: "Sports", value: "sports" },
      { label: "Music", value: "music" },
    ]);

    const handleCreateSkill = (inputValue: string) => {
      const newOption = { 
        label: inputValue, 
        value: inputValue.toLowerCase().replace(/\s+/g, '-') 
      };
      setSkillOptions(prev => [...prev, newOption]);
      return newOption;
    };

    const handleCreateInterest = (inputValue: string) => {
      const newOption = { 
        label: inputValue, 
        value: inputValue.toLowerCase().replace(/\s+/g, '-') 
      };
      setInterestOptions(prev => [...prev, newOption]);
      return newOption;
    };

    const onSubmit = (values: z.infer<typeof formSchema>) => {
      console.log("Form submitted:", values);
      alert(`Form data: ${JSON.stringify(values, null, 2)}`);
    };

    return (
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6 max-w-md"
        >
          <CreatableSelectControl
            control={form.control}
            name="skills"
            label="Technical Skills"
            description="Select existing skills or create new ones"
            options={skillOptions}
            placeholder="Add your skills..."
            isMulti
            isClearable
            onCreateOption={handleCreateSkill}
            formatCreateLabel={(inputValue) => `Add skill: ${inputValue}`}
          />

          <CreatableSelectControl
            control={form.control}
            name="interests"
            label="Personal Interests"
            description="Select or create your interests (optional)"
            options={interestOptions}
            placeholder="Add your interests..."
            isMulti
            isClearable
            onCreateOption={handleCreateInterest}
            formatCreateLabel={(inputValue) => `Add interest: ${inputValue}`}
          />

          <div className="flex gap-2">
            <Button type="submit">Save Profile</Button>
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
          <CreatableSelectControl
            control={form.control}
            name="enabledField"
            label="Enabled Field"
            description="This field is interactive"
            options={basicOptions}
            placeholder="Select or create an option..."
          />

          <CreatableSelectControl
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