import { zodResolver } from "@hookform/resolvers/zod";
import { action } from "@storybook/addon-actions";
import { useArgs } from "@storybook/preview-api";
import type { Meta, StoryObj } from "@storybook/react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Form } from "../form";
import { NumberInput, NumberInputControl } from "../numberInput";

const meta: Meta<typeof NumberInput> = {
  title: "Primitive/NumberInput",
  component: NumberInput,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    value: {
      control: "number",
    },
    min: {
      control: "number",
    },
    max: {
      control: "number",
    },
    step: {
      control: "number",
    },
    precision: {
      control: "number",
    },
    showStepper: {
      control: "boolean",
    },
    allowMouseWheel: {
      control: "boolean",
    },
    clampValueOnBlur: {
      control: "boolean",
    },
    keepWithinRange: {
      control: "boolean",
    },
    disabled: {
      control: "boolean",
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: "Enter a number",
    value: 0,
  },
  render: (args) => {
    const [{ value }, updateArgs] = useArgs();

    const handleChange = (newValue: number | undefined) => {
      updateArgs({ value: newValue });
      action("onChange")(newValue);
    };

    return <NumberInput {...args} value={value} onChange={handleChange} />;
  },
};

export const WithRange: Story = {
  args: {
    placeholder: "Enter a number between 0 and 100",
    value: 50,
    min: 0,
    max: 100,
    step: 1,
  },
  render: (args) => {
    const [{ value }, updateArgs] = useArgs();

    const handleChange = (newValue: number | undefined) => {
      updateArgs({ value: newValue });
      action("onChange")(newValue);
    };

    return <NumberInput {...args} value={value} onChange={handleChange} />;
  },
};

export const WithPrecision: Story = {
  args: {
    placeholder: "Enter a decimal number",
    value: 3.14,
    step: 0.01,
    precision: 2,
  },
  render: (args) => {
    const [{ value }, updateArgs] = useArgs();

    const handleChange = (newValue: number | undefined) => {
      updateArgs({ value: newValue });
      action("onChange")(newValue);
    };

    return <NumberInput {...args} value={value} onChange={handleChange} />;
  },
};

export const WithoutStepper: Story = {
  args: {
    placeholder: "No stepper buttons",
    value: 42,
    showStepper: false,
  },
  render: (args) => {
    const [{ value }, updateArgs] = useArgs();

    const handleChange = (newValue: number | undefined) => {
      updateArgs({ value: newValue });
      action("onChange")(newValue);
    };

    return <NumberInput {...args} value={value} onChange={handleChange} />;
  },
};

export const WithMouseWheel: Story = {
  args: {
    placeholder: "Focus and use mouse wheel",
    value: 10,
    allowMouseWheel: true,
    step: 5,
  },
  render: (args) => {
    const [{ value }, updateArgs] = useArgs();

    const handleChange = (newValue: number | undefined) => {
      updateArgs({ value: newValue });
      action("onChange")(newValue);
    };

    return <NumberInput {...args} value={value} onChange={handleChange} />;
  },
};

export const Disabled: Story = {
  args: {
    placeholder: "Disabled input",
    value: 100,
    disabled: true,
  },
  render: (args) => {
    const [{ value }, updateArgs] = useArgs();

    const handleChange = (newValue: number | undefined) => {
      updateArgs({ value: newValue });
      action("onChange")(newValue);
    };

    return <NumberInput {...args} value={value} onChange={handleChange} />;
  },
};

export const LargeStep: Story = {
  args: {
    placeholder: "Large step increments",
    value: 100,
    step: 25,
    min: 0,
    max: 1000,
  },
  render: (args) => {
    const [{ value }, updateArgs] = useArgs();

    const handleChange = (newValue: number | undefined) => {
      updateArgs({ value: newValue });
      action("onChange")(newValue);
    };

    return <NumberInput {...args} value={value} onChange={handleChange} />;
  },
};

// Form integration examples
const FormExample = ({ unit, ...args }: any) => {
  const form = useForm({
    defaultValues: {
      quantity: 5,
      price: 29.99,
      percentage: 75,
    },
  });

  return (
    <Form {...form}>
      <form className="space-y-4 w-80">
        <NumberInputControl
          control={form.control}
          name="quantity"
          label="Quantity"
          description="Number of items"
          min={1}
          max={100}
          step={1}
          unit={unit}
          {...args}
        />
        <NumberInputControl
          control={form.control}
          name="price"
          label="Price"
          description="Price per item"
          min={0}
          step={0.01}
          precision={2}
          unit="$"
          formatValue={(value) => value.toFixed(2)}
          {...args}
        />
        <NumberInputControl
          control={form.control}
          name="percentage"
          label="Percentage"
          description="Completion percentage"
          min={0}
          max={100}
          step={5}
          unit="%"
          {...args}
        />
      </form>
    </Form>
  );
};

export const WithFormIntegration: Story = {
  render: () => <FormExample />,
};

export const WithUnit: Story = {
  render: () => <FormExample unit="items" />,
};

export const WithCustomFormatting: Story = {
  render: () => {
    const form = useForm({
      defaultValues: {
        fileSize: 1024,
      },
    });

    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    };

    const parseBytes = (value: string): number => {
      const match = value.match(/^([\d.]+)\s*(B|KB|MB|GB)?$/i);
      if (!match) return parseFloat(value) || 0;

      const num = parseFloat(match[1]);
      const unit = (match[2] || "B").toUpperCase();

      const multipliers = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };
      return num * (multipliers[unit as keyof typeof multipliers] || 1);
    };

    return (
      <Form {...form}>
        <form className="w-80">
          <NumberInputControl
            control={form.control}
            name="fileSize"
            label="File Size"
            description="Enter file size in bytes"
            min={0}
            step={1024}
            formatValue={formatBytes}
            parseValue={parseBytes}
          />
        </form>
      </Form>
    );
  },
};

export const ValidationExample: Story = {
  render: () => {
    const form = useForm({
      resolver: zodResolver(z.object({ age: z.number().min(18).max(120) })),
      defaultValues: {
        age: 18,
      },
      mode: "onChange",
    });

    return (
      <Form {...form}>
        <form className="w-80">
          <NumberInputControl
            control={form.control}
            name="age"
            label="Age"
            description="Must be between 18 and 120"
            step={1}
            placeholder="Enter your age"
          />
        </form>
      </Form>
    );
  },
};
