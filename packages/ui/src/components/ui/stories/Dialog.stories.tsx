import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { useState } from "react";

import { Button } from "../button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../dialog";

const meta = {
  title: "Primitive/Dialog",
  component: Dialog,
  tags: ["autodocs"],
  argTypes: {},
  args: {
    onOpenChange: fn(),
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Dialog {...args}>
      <DialogTrigger asChild>
        <Button variant="outline">Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmation</DialogTitle>
          <DialogDescription>
            Are you sure you want to proceed with this action?
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <p>This action cannot be undone. Please confirm your choice.</p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const WithoutDescription: Story = {
  render: (args) => (
    <Dialog {...args}>
      <DialogTrigger asChild>
        <Button variant="outline">Open Simple Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Simple Dialog</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p>This is a simple dialog without a description.</p>
        </DialogBody>
        <DialogFooter>
          <Button>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="space-y-4">
      {["sm", "md", "lg", "xl", "2xl", "3xl"].map((size) => (
        <Dialog key={size}>
          <DialogTrigger asChild>
            <Button variant="outline">{size.toUpperCase()} Dialog</Button>
          </DialogTrigger>
          <DialogContent size={size as any}>
            <DialogHeader>
              <DialogTitle>{size.toUpperCase()} Dialog</DialogTitle>
              <DialogDescription>
                This is a {size} sized dialog example.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <p>Content for {size} dialog size.</p>
            </DialogBody>
            <DialogFooter>
              <Button>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  ),
};

export const Controlled: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    
    return (
      <div className="space-y-4">
        <Button onClick={() => setOpen(true)}>Open Controlled Dialog</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Controlled Dialog</DialogTitle>
              <DialogDescription>
                This dialog is controlled by external state.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <p>The dialog state is managed externally.</p>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setOpen(false)}>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  },
};
