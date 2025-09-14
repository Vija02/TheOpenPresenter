import { zodResolver } from "@hookform/resolvers/zod";
import { useInviteToOrganizationMutation } from "@repo/graphql";
import { extractError } from "@repo/lib";
import { Alert, Button, Form, InputControl } from "@repo/ui";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { z } from "zod";

const inviteSchema = z.object({
  inviteText: z.string().min(1, "Username or email is required"),
});

type InviteFormData = z.infer<typeof inviteSchema>;

type PropTypes = { organization: { id: string } };

export default function InviteNewMember({ organization }: PropTypes) {
  const [, inviteToOrganization] = useInviteToOrganizationMutation();
  const [inviteInProgress, setInviteInProgress] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      inviteText: "",
    },
  });

  const handleInviteSubmit = useCallback(
    async (values: InviteFormData) => {
      if (inviteInProgress) {
        return;
      }
      setError(null);

      const { inviteText } = values;
      setInviteInProgress(true);
      const isEmail = inviteText.includes("@");
      try {
        await inviteToOrganization({
          organizationId: organization.id,
          email: isEmail ? inviteText : null,
          username: isEmail ? null : inviteText,
        });
        toast.success(`'${inviteText}' invited.`);
        form.reset();
      } catch (e: any) {
        setError(e);
      } finally {
        setInviteInProgress(false);
      }
    },
    [inviteInProgress, inviteToOrganization, organization.id, form],
  );

  return (
    <div className="shadow-md p-4">
      <h3 className="text-lg font-semibold mb-4">Invite new member</h3>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleInviteSubmit)}
          className="space-y-4"
        >
          <InputControl
            control={form.control}
            name="inviteText"
            label="Username or Email"
            placeholder="Enter username or email"
          />

          {error && (
            <Alert
              variant="destructive"
              title="Could not invite to organization"
            >
              {extractError(error).message}
            </Alert>
          )}

          <Button type="submit" disabled={inviteInProgress} variant="success">
            Invite
          </Button>
        </form>
      </Form>
    </div>
  );
}
