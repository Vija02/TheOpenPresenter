import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { useState } from "react";

import { ColorPicker } from "../colorPicker";

const meta = {
  title: "Primitive/ColorPicker",
  component: ColorPicker,
  tags: ["autodocs"],
  argTypes: {
    alpha: {
      control: { type: "boolean" },
      description: "Enable alpha channel support (8-character hex)",
    },
    value: {
      control: { type: "text" },
      description: "The color value in hex format",
    },
  },
  args: {
    value: "#FF0000",
    onChange: fn(),
    onBlur: fn(),
  },
} satisfies Meta<typeof ColorPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: "#FF0000",
  },
};

export const WithAlpha: Story = {
  args: {
    value: "#FF0000FF",
    alpha: true,
  },
};

export const TransparentColor: Story = {
  args: {
    value: "#FF000080",
    alpha: true,
  },
};

export const DarkColor: Story = {
  args: {
    value: "#1A1A2E",
  },
};

export const LightColor: Story = {
  args: {
    value: "#F5F5F5",
  },
};

export const Controlled: Story = {
  render: () => {
    const [color, setColor] = useState("#3B82F6");

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Selected Color: {color}
          </label>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <div
          className="w-full h-20 rounded-md border"
          style={{ backgroundColor: color }}
        />
      </div>
    );
  },
};

export const ControlledWithAlpha: Story = {
  render: () => {
    const [color, setColor] = useState("#3B82F680");

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Selected Color: {color}
          </label>
          <ColorPicker value={color} onChange={setColor} alpha />
        </div>
        <div
          className="w-full h-20 rounded-md border"
          style={{
            backgroundColor: color,
            backgroundImage: `linear-gradient(45deg, #ccc 25%, transparent 25%), 
                              linear-gradient(-45deg, #ccc 25%, transparent 25%), 
                              linear-gradient(45deg, transparent 75%, #ccc 75%), 
                              linear-gradient(-45deg, transparent 75%, #ccc 75%)`,
            backgroundSize: "20px 20px",
            backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
          }}
        >
          <div className="w-full h-full" style={{ backgroundColor: color }} />
        </div>
      </div>
    );
  },
};

export const MultipleColors: Story = {
  render: () => {
    const [primaryColor, setPrimaryColor] = useState("#3B82F6");
    const [secondaryColor, setSecondaryColor] = useState("#10B981");
    const [backgroundColor, setBackgroundColor] = useState("#1F2937");

    return (
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            Primary Color
          </label>
          <ColorPicker value={primaryColor} onChange={setPrimaryColor} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            Secondary Color
          </label>
          <ColorPicker value={secondaryColor} onChange={setSecondaryColor} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            Background Color
          </label>
          <ColorPicker value={backgroundColor} onChange={setBackgroundColor} />
        </div>
        <div
          className="w-full p-6 rounded-md"
          style={{ backgroundColor: backgroundColor }}
        >
          <h3
            style={{ color: primaryColor }}
            className="text-xl font-bold mb-2"
          >
            Primary Heading
          </h3>
          <p style={{ color: secondaryColor }}>
            Secondary text content goes here.
          </p>
        </div>
      </div>
    );
  },
};

export const ColorFormats: Story = {
  render: () => {
    const [hexColor, setHexColor] = useState("#E11D48");
    const [hexaColor, setHexaColor] = useState("#E11D48CC");

    return (
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            HEX Format (6 characters)
          </label>
          <ColorPicker value={hexColor} onChange={setHexColor} />
          <p className="text-xs text-gray-500 mt-1">
            Supports HEX and RGB input formats
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            HEXA Format (8 characters with alpha)
          </label>
          <ColorPicker value={hexaColor} onChange={setHexaColor} alpha />
          <p className="text-xs text-gray-500 mt-1">
            Supports HEXA and RGBA input formats
          </p>
        </div>
      </div>
    );
  },
};

export const PresetColors: Story = {
  render: () => {
    const [color, setColor] = useState("#3B82F6");

    const presets = [
      "#EF4444", // red
      "#F97316", // orange
      "#EAB308", // yellow
      "#22C55E", // green
      "#3B82F6", // blue
      "#8B5CF6", // purple
      "#EC4899", // pink
      "#6B7280", // gray
    ];

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Selected: {color}
          </label>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            Quick Presets
          </label>
          <div className="flex gap-2 flex-wrap">
            {presets.map((preset) => (
              <button
                key={preset}
                className="w-8 h-8 rounded-md border border-gray-300 cursor-pointer hover:scale-110 transition-transform"
                style={{ backgroundColor: preset }}
                onClick={() => setColor(preset)}
                title={preset}
              />
            ))}
          </div>
        </div>
      </div>
    );
  },
};
