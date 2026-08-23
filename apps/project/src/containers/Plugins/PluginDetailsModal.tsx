import { zodResolver } from "@hookform/resolvers/zod";
import {
  useCreateClientPluginMutation,
  useUpdateClientPluginMutation,
} from "@repo/graphql";
import { extractError } from "@repo/lib";
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
} from "@repo/ui";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import slugify from "slugify";
import { z } from "zod";

const formSchema = z.object({
  title: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

type FormInputs = z.infer<typeof formSchema>;

export type PluginDetailsModalProps = {
  organizationId: string;
  plugin: {
    id: string;
    title: string;
    description: string | null;
    handle: string;
  } | null;
  onClose: () => void;
  onCreated?: (id: string) => void;
  refetch: () => void;
};

export const PluginDetailsModal = ({
  organizationId,
  plugin,
  onClose,
  onCreated,
  refetch,
}: PluginDetailsModalProps) => {
  const isEdit = plugin !== null;
  const [, createPlugin] = useCreateClientPluginMutation();
  const [, updatePlugin] = useUpdateClientPluginMutation();
  const [error, setError] = useState<Error | null>(null);

  const form = useForm<FormInputs>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: plugin?.title ?? "",
      description: plugin?.description ?? "",
    },
  });

  const handleSubmit = useCallback(
    async (data: FormInputs) => {
      setError(null);
      const title = data.title.trim();
      const description = data.description?.trim() ?? "";

      try {
        if (isEdit) {
          await updatePlugin({
            input: { id: plugin.id, patch: { title, description } },
          });
          toast.success("Plugin updated");
        } else {
          const res = await createPlugin({
            input: {
              clientPlugin: {
                ownerOrganizationId: organizationId,
                handle:
                  slugify(title, { lower: true, strict: true }).slice(0, 40) ||
                  `plugin-${Date.now()}`,
                title,
                description,
              },
            },
          });
          const id = res?.createClientPlugin?.clientPlugin?.id;
          if (!id) throw new Error("Failed to create plugin");
          onCreated?.(id);
        }
        refetch();
        onClose();
      } catch (e: any) {
        setError(e);
      }
    },
    [
      createPlugin,
      isEdit,
      onClose,
      onCreated,
      organizationId,
      plugin,
      refetch,
      updatePlugin,
    ],
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <Form {...form}>
        <DialogContent
          className="max-w-lg"
          render={<form onSubmit={form.handleSubmit(handleSubmit)} />}
        >
          <DialogHeader>
            <DialogTitle>{isEdit ? "Update plugin" : "New plugin"}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {error && (
              <Alert variant="destructive" title="Error" className="mb-4">
                {extractError(error).message}
              </Alert>
            )}

            <InputControl
              control={form.control}
              name="title"
              label="Name"
              placeholder="e.g. Countdown Timer"
              autoFocus
            />

            <InputControl
              control={form.control}
              name="description"
              label="Description"
              placeholder="What does this plugin do?"
            />
          </DialogBody>
          <DialogFooter>
            <div className="flex gap-2">
              <Button type="submit" variant="success">
                {isEdit ? "Save" : "Create"}
              </Button>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Form>
    </Dialog>
  );
};
