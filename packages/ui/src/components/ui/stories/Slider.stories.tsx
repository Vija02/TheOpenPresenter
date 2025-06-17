import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { useState } from "react";

import { Slider } from "../slider";

const meta = {
  title: "Primitive/Slider",
  component: Slider,
  tags: ["autodocs"],
  argTypes: {
    min: {
      control: { type: "number" },
    },
    max: {
      control: { type: "number" },
    },
    step: {
      control: { type: "number" },
    },
    disabled: {
      control: { type: "boolean" },
    },
    orientation: {
      control: { type: "select" },
      options: ["horizontal", "vertical"],
    },
  },
  args: {
    defaultValue: [50],
    min: 0,
    max: 100,
    step: 1,
    onValueChange: fn(),
  },
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    defaultValue: [50],
  },
};

export const WithRange: Story = {
  args: {
    defaultValue: [25, 75],
    min: 0,
    max: 100,
  },
};

export const CustomRange: Story = {
  args: {
    defaultValue: [20],
    min: 0,
    max: 200,
    step: 10,
  },
};

export const Disabled: Story = {
  args: {
    defaultValue: [50],
    disabled: true,
  },
};

export const Vertical: Story = {
  args: {
    defaultValue: [50],
    orientation: "vertical",
    className: "h-48",
  },
};

export const VerticalRange: Story = {
  args: {
    defaultValue: [25, 75],
    orientation: "vertical",
    className: "h-48",
  },
};

export const Controlled: Story = {
  render: () => {
    const [value, setValue] = useState([50]);
    
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Value: {value[0]}
          </label>
          <Slider
            value={value}
            onValueChange={setValue}
            min={0}
            max={100}
            step={1}
          />
        </div>
      </div>
    );
  },
};

export const ControlledRange: Story = {
  render: () => {
    const [value, setValue] = useState([25, 75]);
    
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Range: {value[0]} - {value[1]}
          </label>
          <Slider
            value={value}
            onValueChange={setValue}
            min={0}
            max={100}
            step={1}
          />
        </div>
      </div>
    );
  },
};

export const DifferentSteps: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <label className="block text-sm font-medium mb-2">Step: 1</label>
        <Slider defaultValue={[50]} min={0} max={100} step={1} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Step: 5</label>
        <Slider defaultValue={[50]} min={0} max={100} step={5} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Step: 10</label>
        <Slider defaultValue={[50]} min={0} max={100} step={10} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Step: 25</label>
        <Slider defaultValue={[50]} min={0} max={100} step={25} />
      </div>
    </div>
  ),
};
