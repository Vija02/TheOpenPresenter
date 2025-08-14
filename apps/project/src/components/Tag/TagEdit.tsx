import { ApolloError } from "@apollo/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { TagFragment } from "@repo/graphql";
import { extractError } from "@repo/lib";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  Button,
  Form,
  InputControl,
  Label,
  SelectControl,
} from "@repo/ui";
import { useCallback } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Tag } from "./Tag";

export type TagType = Pick<
  TagFragment,
  "name" | "description" | "backgroundColor" | "foregroundColor" | "variant"
>;

export type TagEditPropTypes = {
  initialTag: TagType;
  onCreate: (tag: TagType) => Promise<any>;
  onCancel: () => void;
  error: ApolloError | null;
  submitText?: string;
};

const formSchema = z.object({
  name: z.string().min(1, "Tag name must not be empty"),
  description: z.string().nullable().optional(),
  backgroundColor: z.string().nullable().optional(),
  foregroundColor: z.string().nullable().optional(),
  variant: z.string().nullable().optional(),
});

export function TagEdit({
  initialTag,
  onCreate,
  onCancel,
  error,
  submitText = "Create",
}: TagEditPropTypes) {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: initialTag,
  });

  const handleCreate = useCallback(
    (values: z.infer<typeof formSchema>) => {
      const tagValues: TagType = {
        name: values.name,
        description: values.description ?? null,
        backgroundColor: values.backgroundColor ?? null,
        foregroundColor: values.foregroundColor ?? null,
        variant: values.variant ?? null,
      };
      onCreate(tagValues).then((res) => {
        form.reset();
        return res;
      });
    },
    [onCreate, form],
  );

  const watchedValues = form.watch();

  // Convert form values to TagType for preview
  const previewTag: TagType = {
    name: watchedValues.name || "",
    description: watchedValues.description ?? null,
    backgroundColor: watchedValues.backgroundColor ?? null,
    foregroundColor: watchedValues.foregroundColor ?? null,
    variant: watchedValues.variant ?? null,
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleCreate)}>
        <div className="stack-col items-start gap-5">
          <div className="flex w-full flex-wrap">
            <div className="stack-col items-start min-w-[200px] flex-1 flex-shrink">
              <InputControl
                control={form.control}
                name="name"
                label="Tag Name"
                placeholder="Tag Name"
              />
              <InputControl
                control={form.control}
                name="description"
                label="Description"
                placeholder="Description (optional)"
              />

              <InputControl
                control={form.control}
                name="backgroundColor"
                label="Background Color"
              />

              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="advanced">
                  <AccordionTrigger>Advanced</AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="stack-col items-start">
                      <InputControl
                        control={form.control}
                        name="foregroundColor"
                        label="Foreground Color"
                      />
                      <SelectControl
                        control={form.control}
                        label="Variant"
                        name="variant"
                        placeholder="Select variant"
                        options={[
                          { value: "solid", label: "Solid" },
                          { value: "outline", label: "Outline" },
                        ]}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
            <div className="stack-col min-w-[200px] flex-1 flex-shrink justify-center">
              <Label>Preview</Label>
              <Tag tag={previewTag} placeholder="Preview Tag" />
            </div>
          </div>

          {error ? (
            <Alert
              variant="destructive"
              title="Error performing this operation"
            >
              {extractError(error).message}
            </Alert>
          ) : null}
          <div className="stack-row self-start">
            <Button variant="success" type="submit">
              {submitText}
            </Button>
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
