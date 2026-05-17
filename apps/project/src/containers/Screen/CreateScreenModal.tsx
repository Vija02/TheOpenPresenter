import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateScreenMutation } from "@repo/graphql";
import { extractError, globalState } from "@repo/lib";
import {
  Alert,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  InputControl,
  useOverlayToggle,
} from "@repo/ui";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import slugify from "slugify";
import { z } from "zod";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().optional(),
});

type FormInputs = z.infer<typeof formSchema>;

export type CreateScreenModalPropTypes = {
  organizationId: string;
};

const CreateScreenModal = ({ organizationId }: CreateScreenModalPropTypes) => {
  const { isOpen, onToggle, resetData } = useOverlayToggle();

  const [, createScreen] = useCreateScreenMutation();
  const { publish } = globalState.modelDataAccess.usePublishAPIChanges({
    token: "page",
  });

  const [error, setError] = useState<Error | null>(null);

  const form = useForm<FormInputs>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  const handleSubmit = useCallback(
    async (data: FormInputs) => {
      setError(null);
      const name = data.name.trim();
      const rawSlug = data.slug?.trim();
      const slug = slugify(rawSlug ? rawSlug : name, { lower: true });

      try {
        await createScreen({
          organizationId,
          name,
          slug,
        });
        publish();
        toast.success("Screen created");
        onToggle?.();
        resetData?.();
      } catch (e: any) {
        setError(e);
      }
    },
    [createScreen, onToggle, organizationId, publish, resetData],
  );

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle}>
      <Form {...form}>
        <DialogContent
          className="max-w-lg"
          render={<form onSubmit={form.handleSubmit(handleSubmit)} />}
        >
          <DialogHeader>
            <DialogTitle>New Screen</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {error && (
              <Alert variant="destructive" title="Error" className="mb-4">
                {extractError(error).message}
              </Alert>
            )}

            <InputControl
              control={form.control}
              name="name"
              label="Name"
              placeholder="e.g. Main Auditorium"
              autoFocus
            />

            <InputControl
              control={form.control}
              name="slug"
              label="Slug"
              placeholder="Auto-generated from name if blank"
              description="Used in the screen URL. Leave blank to derive from name."
            />
          </DialogBody>
          <DialogFooter>
            <div className="flex gap-2">
              <Button type="submit" variant="success">
                Create
              </Button>
              <Button variant="outline" onClick={onToggle}>
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Form>
    </Dialog>
  );
};

export default CreateScreenModal;
