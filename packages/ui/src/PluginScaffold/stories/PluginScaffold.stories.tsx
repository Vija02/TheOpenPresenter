import type { Meta, StoryObj } from "@storybook/react";
import {
  Download,
  Edit,
  Pause,
  Play,
  Plus,
  Save,
  Settings,
  SkipForward,
  Trash2,
  Upload,
  Volume2,
  X,
} from "lucide-react";

import { Button } from "../../components/ui/button";
import { PluginScaffold } from "../PluginScaffold";

const meta = {
  title: "Composite/PluginScaffold",
  component: PluginScaffold,
  tags: ["autodocs"],
  argTypes: {
    title: {
      control: "text",
      description: "The title displayed in the header",
    },
    toolbar: {
      control: false,
      description: "Optional toolbar content",
    },
    postToolbar: {
      control: false,
      description: "Optional post-toolbar content",
    },
    body: {
      control: false,
      description: "Optional body content",
    },
  },
} satisfies Meta<typeof PluginScaffold>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  decorators: [
    (Story, context) => (
      <div className="h-[80vh]">
        <Story {...context} />
      </div>
    ),
  ],
  args: {
    title: "Plugin Title",
  },
};

export const WithToolbar: Story = {
  decorators: [
    (Story, context) => (
      <div className="h-[80vh]">
        <Story {...context} />
      </div>
    ),
  ],
  args: {
    title: "Plugin with Toolbar",
    toolbar: (
      <div className="flex gap-2">
        <Button variant="pill" size="xs">
          <Plus />
          New
        </Button>
        <Button variant="pill" size="xs">
          <Save />
          Save
        </Button>
        <Button variant="pill" size="xs">
          <Upload />
          Import
        </Button>
        <Button variant="pill" size="xs">
          <Download />
          Export
        </Button>
        <Button variant="pill" size="xs">
          <Edit />
          Edit
        </Button>
      </div>
    ),
  },
};

export const WithPostToolbar: Story = {
  decorators: [
    (Story, context) => (
      <div className="h-[80vh]">
        <Story {...context} />
      </div>
    ),
  ],
  args: {
    title: "Plugin with Post Toolbar",
    postToolbar: (
      <div className="flex gap-2">
        <Button variant="pill" size="xs">
          <Volume2 />
        </Button>
        <Button variant="pill" size="xs">
          <Settings />
        </Button>
        <Button variant="pill" size="xs">
          <Trash2 />
        </Button>
        <Button variant="pill" size="xs">
          <X />
        </Button>
      </div>
    ),
  },
};

export const MediaControlsSample: Story = {
  decorators: [
    (Story, context) => (
      <div className="h-[80vh]">
        <Story {...context} />
      </div>
    ),
  ],
  args: {
    title: "Media Player Plugin",
    toolbar: (
      <div className="flex gap-2">
        <Button variant="pill" size="xs">
          <Play />
          Play
        </Button>
        <Button variant="pill" size="xs">
          <Pause />
          Pause
        </Button>
        <Button variant="pill" size="xs">
          <SkipForward />
          Next
        </Button>
      </div>
    ),
    postToolbar: (
      <div className="flex gap-2">
        <Button variant="pill" size="xs">
          <Volume2 />
        </Button>
        <Button variant="pill" size="xs">
          <Settings />
        </Button>
        <Button variant="pill" size="xs">
          <X />
        </Button>
      </div>
    ),
  },
};

export const ResponsiveToolbar: Story = {
  decorators: [
    (Story, context) => (
      <div className="h-[80vh] resize-x overflow-hidden border max-w-full w-[900px] min-w-[200px]">
        <Story {...context} />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story:
          "Drag the bottom-right corner to resize. When the toolbar doesn't fit, buttons first drop their labels, then collapse behind a menu button.",
      },
    },
  },
  args: {
    title: "Responsive Plugin",
    toolbar: (
      <>
        <Button variant="pill" size="xs">
          <Plus />
          New
        </Button>
        <Button variant="pill" size="xs">
          <Save />
          Save
        </Button>
        <Button variant="pill" size="xs">
          <Upload />
          Import
        </Button>
        <Button variant="pill" size="xs">
          <Download />
          Export
        </Button>
        <Button variant="pill" size="xs">
          Text only
        </Button>
      </>
    ),
    postToolbar: (
      <Button variant="pill" size="xs">
        <Settings />
        Settings
      </Button>
    ),
  },
};
