import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import { type OptionType, Select } from "../select";

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
  args: {
    placeholder: "Select your preference...",
  },
  render: (args) => {
    return (
      <div className="space-y-4 max-w-md">
        <div>
          <label className="block text-sm font-medium mb-2">
            Favorite Fruit
          </label>
          <Select {...args} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            Multiple Selection
          </label>
          <Select
            {...args}
            isMulti
            isClearable
            placeholder="Select multiple fruits..."
          />
        </div>
      </div>
    );
  },
};

export const ErrorState: Story = {
  args: {
    placeholder: "Select an option...",
  },
  render: (args) => {
    return (
      <div className="space-y-2">
        <Select {...args} />
        <p className="text-sm text-red-600">This field is required</p>
      </div>
    );
  },
};
