import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { useState } from "react";

import { Button } from "../button";
import {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription
} from "../sheet";

const meta = {
  title: "Primitive/Sheet",
  component: Sheet,
  tags: ["autodocs"],
  argTypes: {},
  args: {
    onOpenChange: fn(),
  },
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Sheet {...args}>
      <SheetTrigger asChild>
        <Button variant="outline">Open Sheet</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Sheet Title</SheetTitle>
          <SheetDescription>
            This is a description for the sheet component.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          <p>This is the content of the sheet.</p>
          <p>You can put any content here.</p>
        </div>
        <SheetFooter>
          <Button variant="outline" asChild>
            <SheetClose>Close</SheetClose>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

export const WithoutDescription: Story = {
  render: (args) => (
    <Sheet {...args}>
      <SheetTrigger asChild>
        <Button variant="outline">Open Simple Sheet</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Simple Sheet</SheetTitle>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          <p>This is a simple sheet without a description.</p>
        </div>
        <SheetFooter>
          <Button asChild>
            <SheetClose>Close</SheetClose>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

export const Sides: Story = {
  render: () => (
    <div className="space-y-4">
      {["top", "right", "bottom", "left"].map((side) => (
        <Sheet key={side}>
          <SheetTrigger asChild>
            <Button variant="outline">{side.charAt(0).toUpperCase() + side.slice(1)} Sheet</Button>
          </SheetTrigger>
          <SheetContent side={side as any}>
            <SheetHeader>
              <SheetTitle>{side.charAt(0).toUpperCase() + side.slice(1)} Sheet</SheetTitle>
              <SheetDescription>
                This sheet slides in from the {side}.
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 py-4">
              <p>Content for {side} sheet.</p>
            </div>
            <SheetFooter>
              <Button asChild>
                <SheetClose>Close</SheetClose>
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ))}
    </div>
  ),
};

export const Controlled: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    
    return (
      <div className="space-y-4">
        <Button onClick={() => setOpen(true)}>Open Controlled Sheet</Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Controlled Sheet</SheetTitle>
              <SheetDescription>
                This sheet is controlled by external state.
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 py-4">
              <p>The sheet state is managed externally.</p>
            </div>
            <SheetFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setOpen(false)}>Confirm</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    );
  },
};
