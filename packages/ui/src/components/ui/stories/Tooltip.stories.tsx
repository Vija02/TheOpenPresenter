import type { Meta, StoryObj } from "@storybook/react";

import { 
  Tooltip, 
  TooltipTrigger, 
  TooltipContent,
  TooltipProvider 
} from "../tooltip";

const meta = {
  title: "Primitive/Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
  argTypes: {},
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className="flex justify-center p-8">
      <Tooltip {...args}>
        <TooltipTrigger asChild>
          <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Hover me
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>This is a tooltip</p>
        </TooltipContent>
      </Tooltip>
    </div>
  ),
  args: {},
};

export const WithDelay: Story = {
  render: (args) => (
    <div className="flex justify-center p-8">
      <TooltipProvider delayDuration={1000}>
        <Tooltip {...args}>
          <TooltipTrigger asChild>
            <button className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
              Hover me (1s delay)
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>This tooltip has a 1 second delay</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  ),
  args: {},
};

export const DifferentSides: Story = {
  render: (args) => (
    <div className="flex flex-col items-center gap-8 p-16">
      <Tooltip {...args}>
        <TooltipTrigger asChild>
          <button className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600">
            Top (default)
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Tooltip on top</p>
        </TooltipContent>
      </Tooltip>
      
      <Tooltip {...args}>
        <TooltipTrigger asChild>
          <button className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600">
            Bottom
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Tooltip on bottom</p>
        </TooltipContent>
      </Tooltip>
      
      <div className="flex gap-8">
        <Tooltip {...args}>
          <TooltipTrigger asChild>
            <button className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600">
              Left
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Tooltip on left</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip {...args}>
          <TooltipTrigger asChild>
            <button className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600">
              Right
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Tooltip on right</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  ),
  args: {},
};

export const WithCustomContent: Story = {
  render: (args) => (
    <div className="flex justify-center p-8">
      <Tooltip {...args}>
        <TooltipTrigger asChild>
          <button className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600">
            Rich content
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div>
            <h4 className="font-semibold mb-1">Rich Tooltip</h4>
            <p className="text-sm">
              This tooltip contains multiple elements including a title and description.
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  ),
  args: {},
};