import type { Meta, StoryObj } from "@storybook/react";

import { 
  Accordion, 
  AccordionItem, 
  AccordionTrigger, 
  AccordionContent 
} from "../accordion";

const meta = {
  title: "Primitive/Accordion",
  component: Accordion,
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: { type: "radio" },
      options: ["single", "multiple"],
    },
    disabled: {
      control: "boolean",
    },
    collapsible: {
      control: "boolean",
    },
  },
} satisfies Meta<typeof Accordion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    type: "single",
    collapsible: true,
    children: (
      <>
        <AccordionItem value="item-1">
          <AccordionTrigger>Is it accessible?</AccordionTrigger>
          <AccordionContent>
            Yes. It adheres to the WAI-ARIA design pattern.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>Is it styled?</AccordionTrigger>
          <AccordionContent>
            Yes. It comes with default styles that match your design system.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-3">
          <AccordionTrigger>Is it animated?</AccordionTrigger>
          <AccordionContent>
            Yes. It's animated by default, but you can disable it if needed.
          </AccordionContent>
        </AccordionItem>
      </>
    ),
  },
};

export const Multiple: Story = {
  args: {
    type: "multiple",
    children: (
      <>
        <AccordionItem value="item-1">
          <AccordionTrigger>How do I use this component?</AccordionTrigger>
          <AccordionContent>
            You can use it by importing the Accordion components and composing them as needed.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>Can I customize it?</AccordionTrigger>
          <AccordionContent>
            Yes, you can customize the styling through CSS classes.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-3">
          <AccordionTrigger>Does it support keyboard navigation?</AccordionTrigger>
          <AccordionContent>
            Yes, it follows WAI-ARIA standards for accessibility.
          </AccordionContent>
        </AccordionItem>
      </>
    ),
  },
};

export const WithDisabledItems: Story = {
  args: {
    type: "single",
    collapsible: true,
    children: (
      <>
        <AccordionItem value="item-1">
          <AccordionTrigger>Can items be disabled?</AccordionTrigger>
          <AccordionContent>
            Yes, individual items or the entire accordion can be disabled.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2" disabled>
          <AccordionTrigger>This item is disabled</AccordionTrigger>
          <AccordionContent>
            You cannot open this item because it is disabled.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-3">
          <AccordionTrigger>Can I disable just one item?</AccordionTrigger>
          <AccordionContent>
            Yes, you can disable specific items by setting the disabled prop on AccordionItem.
          </AccordionContent>
        </AccordionItem>
      </>
    ),
  },
};