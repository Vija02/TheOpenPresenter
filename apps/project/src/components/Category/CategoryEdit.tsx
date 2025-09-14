import { zodResolver } from "@hookform/resolvers/zod";
import { CategoryFragment } from "@repo/graphql";
import { extractError } from "@repo/lib";
import { Alert, Button, Form, InputControl } from "@repo/ui";
import { useCallback } from "react";
import { useForm } from "react-hook-form";
import { CombinedError } from "urql";
import { z } from "zod";

export type CategoryType = Pick<CategoryFragment, "name">;

export type CategoryEditPropTypes = {
  initialCategory: CategoryType;
  onCreate: (category: CategoryType) => Promise<any>;
  onCancel: () => void;
  error: CombinedError | null;
  submitText?: string;
};

const formSchema = z.object({
  name: z.string().min(1, "Name must not be empty"),
});

export function CategoryEdit({
  initialCategory,
  onCreate,
  onCancel,
  error,
  submitText = "Create",
}: CategoryEditPropTypes) {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: initialCategory,
  });

  const handleCreate = useCallback(
    async (values: CategoryType) => {
      await onCreate(values);
      form.reset();
    },
    [onCreate, form],
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleCreate)}>
        <div className="stack-col items-start gap-5">
          <div className="w-full flex flex-wrap">
            <div className="min-w-[200px] flex-1 flex-shrink stack-col items-start">
              <InputControl
                control={form.control}
                name="name"
                label="Name"
                placeholder="Name"
              />
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

          <div className="stack-row items-start">
            <Button
              variant="success"
              type="submit"
              isLoading={form.formState.isSubmitting}
            >
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
