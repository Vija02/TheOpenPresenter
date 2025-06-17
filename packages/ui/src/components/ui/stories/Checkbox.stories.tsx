import { zodResolver } from "@hookform/resolvers/zod";
import { action } from "@storybook/addon-actions";
import { useArgs } from "@storybook/preview-api";
import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { cn } from "../../../lib/utils";
import { Checkbox, CheckboxControl } from "../checkbox";
import { Form, FormLabel } from "../form";

const meta: Meta<typeof Checkbox> = {
  title: "Primitive/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  argTypes: {
    checked: {
      control: "boolean",
    },
    disabled: {
      control: "boolean",
    },
    required: {
      control: "boolean",
    },
  },
  decorators: [
    (Story, context) => (
      <div className="flex">
        <Story {...context} />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    checked: false,
  },
  render: (args) => {
    const [{ checked }, updateArgs] = useArgs();

    const handleCheckedChange = (newChecked: boolean) => {
      updateArgs({ checked: newChecked });
      action("onCheckedChange")(newChecked);
    };

    return (
      <Checkbox
        {...args}
        checked={checked}
        onCheckedChange={handleCheckedChange}
      />
    );
  },
};

export const Checked: Story = {
  args: {
    checked: true,
  },
  render: (args) => {
    const [{ checked }, updateArgs] = useArgs();

    const handleCheckedChange = (newChecked: boolean) => {
      updateArgs({ checked: newChecked });
      action("onCheckedChange")(newChecked);
    };

    return (
      <Checkbox
        {...args}
        checked={checked}
        onCheckedChange={handleCheckedChange}
      />
    );
  },
};

export const Disabled: Story = {
  args: {
    checked: false,
    disabled: true,
  },
  render: (args) => {
    const [{ checked }, updateArgs] = useArgs();

    const handleCheckedChange = (newChecked: boolean) => {
      updateArgs({ checked: newChecked });
      action("onCheckedChange")(newChecked);
    };

    return (
      <Checkbox
        {...args}
        checked={checked}
        onCheckedChange={handleCheckedChange}
      />
    );
  },
};

export const DisabledChecked: Story = {
  args: {
    checked: true,
    disabled: true,
  },
  render: (args) => {
    const [{ checked }, updateArgs] = useArgs();

    const handleCheckedChange = (newChecked: boolean) => {
      updateArgs({ checked: newChecked });
      action("onCheckedChange")(newChecked);
    };

    return (
      <Checkbox
        {...args}
        checked={checked}
        onCheckedChange={handleCheckedChange}
      />
    );
  },
};

export const WithLabel: Story = {
  render: () => {
    const [checked, setChecked] = React.useState(false);

    return (
      <div className="stack-row">
        <Checkbox
          id="terms"
          checked={checked}
          onCheckedChange={(value) => setChecked(value as boolean)}
        />
        <label
          htmlFor="terms"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Accept terms and conditions
        </label>
      </div>
    );
  },
};

export const MultipleCheckboxes: Story = {
  render: () => {
    const [items, setItems] = React.useState([
      { id: "item1", label: "Item 1", checked: false },
      { id: "item2", label: "Item 2", checked: true },
      { id: "item3", label: "Item 3", checked: false },
      {
        id: "item4",
        label: "Item 4 (Disabled)",
        checked: false,
        disabled: true,
      },
    ]);

    const handleItemChange = (id: string, checked: boolean) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, checked } : item)),
      );
    };

    return (
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center space-x-2">
            <Checkbox
              id={item.id}
              checked={item.checked}
              disabled={item.disabled}
              onCheckedChange={(checked) =>
                handleItemChange(item.id, checked as boolean)
              }
            />
            <label
              htmlFor={item.id}
              className={cn(
                "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
                item.disabled && "opacity-50",
              )}
            >
              {item.label}
            </label>
          </div>
        ))}
      </div>
    );
  },
};

// Form integration examples
const FormExample = () => {
  const form = useForm({
    defaultValues: {
      marketing: false,
      notifications: true,
      newsletter: false,
      terms: false,
    },
  });

  return (
    <Form {...form}>
      <form className="space-y-4 w-80">
        <CheckboxControl
          control={form.control}
          name="marketing"
          label="Marketing emails"
          description="Receive emails about new products, features, and more."
        />
        <CheckboxControl
          control={form.control}
          name="notifications"
          label="Push notifications"
          description="Get notified when something happens."
        />
        <CheckboxControl
          control={form.control}
          name="newsletter"
          label="Weekly newsletter"
          description="Subscribe to our weekly newsletter."
        />
        <CheckboxControl
          control={form.control}
          name="terms"
          label="Accept terms and conditions"
          description="You agree to our Terms of Service and Privacy Policy."
        />
      </form>
    </Form>
  );
};

export const WithFormIntegration: Story = {
  render: () => <FormExample />,
};

export const ValidationExample: Story = {
  render: () => {
    const form = useForm({
      resolver: zodResolver(
        z.object({
          terms: z.boolean().refine((val) => val === true, {
            message: "You must accept the terms and conditions",
          }),
          privacy: z.boolean().refine((val) => val === true, {
            message: "You must accept the privacy policy",
          }),
          marketing: z.boolean().optional(),
        }),
      ),
      defaultValues: {
        terms: false,
        privacy: false,
        marketing: false,
      },
      mode: "onChange",
    });

    return (
      <Form {...form}>
        <form className="space-y-4 w-80">
          <CheckboxControl
            control={form.control}
            name="terms"
            label="Accept terms and conditions"
            description="You must accept our terms to continue."
          />
          <CheckboxControl
            control={form.control}
            name="privacy"
            label="Accept privacy policy"
            description="You must accept our privacy policy to continue."
          />
          <CheckboxControl
            control={form.control}
            name="marketing"
            label="Marketing communications (optional)"
            description="Receive promotional emails and updates."
          />
        </form>
      </Form>
    );
  },
};

export const IndeterminateExample: Story = {
  render: () => {
    const [checkedItems, setCheckedItems] = React.useState([
      false,
      false,
      false,
    ]);

    const allChecked = checkedItems.every(Boolean);
    const isIndeterminate = checkedItems.some(Boolean) && !allChecked;

    return (
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={
              allChecked ? true : isIndeterminate ? "indeterminate" : false
            }
            onCheckedChange={(checked) => {
              setCheckedItems([
                checked as boolean,
                checked as boolean,
                checked as boolean,
              ]);
            }}
          />
          <label className="text-sm font-medium leading-none">
            Select all items
          </label>
        </div>
        <div className="ml-6 space-y-2">
          {checkedItems.map((checked, index) => (
            <div key={index} className="flex items-center space-x-2">
              <Checkbox
                checked={checked}
                onCheckedChange={(newChecked) => {
                  setCheckedItems((prev) =>
                    prev.map((item, i) =>
                      i === index ? (newChecked as boolean) : item,
                    ),
                  );
                }}
              />
              <label className="text-sm font-medium leading-none">
                Item {index + 1}
              </label>
            </div>
          ))}
        </div>
      </div>
    );
  },
};

export const WithCustomStyling: Story = {
  render: () => {
    const [checked, setChecked] = React.useState(false);

    return (
      <div className="flex items-center space-x-2">
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => setChecked(value as boolean)}
          className="border-2 border-blue-500 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
        />
        <label className="text-sm font-medium leading-none">
          Custom styled checkbox
        </label>
      </div>
    );
  },
};
