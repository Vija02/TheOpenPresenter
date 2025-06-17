import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import { Button } from "../button";
import { Input } from "../input";
import { Label } from "../label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../tabs";

const meta = {
  title: "Primitive/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  argTypes: {
    orientation: {
      control: { type: "select" },
      options: ["horizontal", "vertical"],
    },
  },
  args: {
    defaultValue: "tab1",
    onValueChange: fn(),
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Tabs {...args}>
      <TabsList>
        <TabsTrigger value="tab1">Account</TabsTrigger>
        <TabsTrigger value="tab2">Password</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1" className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" defaultValue="Pedro Duarte" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input id="username" defaultValue="@peduarte" />
        </div>
        <Button>Save changes</Button>
      </TabsContent>
      <TabsContent value="tab2" className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="current">Current password</Label>
          <Input id="current" type="password" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new">New password</Label>
          <Input id="new" type="password" />
        </div>
        <Button>Change password</Button>
      </TabsContent>
    </Tabs>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          Overview
        </TabsTrigger>
        <TabsTrigger value="analytics">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          Analytics
        </TabsTrigger>
        <TabsTrigger value="settings">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Settings
        </TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <h3 className="text-lg font-semibold mb-2">Overview</h3>
        <p className="text-secondary">Dashboard overview content goes here.</p>
      </TabsContent>
      <TabsContent value="analytics">
        <h3 className="text-lg font-semibold mb-2">Analytics</h3>
        <p className="text-secondary">
          Analytics and metrics content goes here.
        </p>
      </TabsContent>
      <TabsContent value="settings">
        <h3 className="text-lg font-semibold mb-2">Settings</h3>
        <p className="text-secondary">
          Application settings content goes here.
        </p>
      </TabsContent>
    </Tabs>
  ),
};

export const ManyTabs: Story = {
  render: () => (
    <Tabs defaultValue="tab1">
      <TabsList>
        <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        <TabsTrigger value="tab3">Tab 3</TabsTrigger>
        <TabsTrigger value="tab4">Tab 4</TabsTrigger>
        <TabsTrigger value="tab5">Tab 5</TabsTrigger>
        <TabsTrigger value="tab6">Tab 6</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">
        <h3 className="text-lg font-semibold mb-2">Content 1</h3>
        <p className="text-secondary">This is the content for tab 1.</p>
      </TabsContent>
      <TabsContent value="tab2">
        <h3 className="text-lg font-semibold mb-2">Content 2</h3>
        <p className="text-secondary">This is the content for tab 2.</p>
      </TabsContent>
      <TabsContent value="tab3">
        <h3 className="text-lg font-semibold mb-2">Content 3</h3>
        <p className="text-secondary">This is the content for tab 3.</p>
      </TabsContent>
      <TabsContent value="tab4">
        <h3 className="text-lg font-semibold mb-2">Content 4</h3>
        <p className="text-secondary">This is the content for tab 4.</p>
      </TabsContent>
      <TabsContent value="tab5">
        <h3 className="text-lg font-semibold mb-2">Content 5</h3>
        <p className="text-secondary">This is the content for tab 5.</p>
      </TabsContent>
      <TabsContent value="tab6">
        <h3 className="text-lg font-semibold mb-2">Content 6</h3>
        <p className="text-secondary">This is the content for tab 6.</p>
      </TabsContent>
    </Tabs>
  ),
};

export const Vertical: Story = {
  render: () => (
    <Tabs
      defaultValue="general"
      orientation="vertical"
      className="flex flex-row gap-2"
    >
      <TabsList className="flex-col h-fit w-[200px]">
        <TabsTrigger value="general" className="w-full justify-start">
          General
        </TabsTrigger>
        <TabsTrigger value="security" className="w-full justify-start">
          Security
        </TabsTrigger>
        <TabsTrigger value="integrations" className="w-full justify-start">
          Integrations
        </TabsTrigger>
        <TabsTrigger value="support" className="w-full justify-start">
          Support
        </TabsTrigger>
        <TabsTrigger value="organizations" className="w-full justify-start">
          Organizations
        </TabsTrigger>
        <TabsTrigger value="advanced" className="w-full justify-start">
          Advanced
        </TabsTrigger>
      </TabsList>
      <div className="flex-1">
        <TabsContent value="general" className="mt-0">
          <div className="p-4 border rounded-lg">
            <h3 className="text-lg font-semibold mb-2">General Settings</h3>
            <p className="text-secondary">
              Configure your general preferences here.
            </p>
          </div>
        </TabsContent>
        <TabsContent value="security" className="mt-0">
          <div className="p-4 border rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Security Settings</h3>
            <p className="text-secondary">
              Manage your security and privacy settings.
            </p>
          </div>
        </TabsContent>
        <TabsContent value="integrations" className="mt-0">
          <div className="p-4 border rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Integrations</h3>
            <p className="text-secondary">Connect with third-party services.</p>
          </div>
        </TabsContent>
        <TabsContent value="support" className="mt-0">
          <div className="p-4 border rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Support</h3>
            <p className="text-secondary">Get help and contact support.</p>
          </div>
        </TabsContent>
        <TabsContent value="organizations" className="mt-0">
          <div className="p-4 border rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Organizations</h3>
            <p className="text-secondary">Manage your organization settings.</p>
          </div>
        </TabsContent>
        <TabsContent value="advanced" className="mt-0">
          <div className="p-4 border rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Advanced Settings</h3>
            <p className="text-secondary">Advanced configuration options.</p>
          </div>
        </TabsContent>
      </div>
    </Tabs>
  ),
};

export const DisabledTab: Story = {
  render: () => (
    <Tabs defaultValue="available">
      <TabsList>
        <TabsTrigger value="available">Available</TabsTrigger>
        <TabsTrigger value="disabled" disabled>
          Disabled
        </TabsTrigger>
        <TabsTrigger value="another">Another</TabsTrigger>
      </TabsList>
      <TabsContent value="available">
        <h3 className="text-lg font-semibold mb-2">Available Tab</h3>
        <p className="text-secondary">
          This tab is available and can be clicked.
        </p>
      </TabsContent>
      <TabsContent value="disabled">
        <h3 className="text-lg font-semibold mb-2">Disabled Tab</h3>
        <p className="text-secondary">
          This tab is disabled and cannot be accessed.
        </p>
      </TabsContent>
      <TabsContent value="another">
        <h3 className="text-lg font-semibold mb-2">Another Tab</h3>
        <p className="text-secondary">This is another available tab.</p>
      </TabsContent>
    </Tabs>
  ),
};
