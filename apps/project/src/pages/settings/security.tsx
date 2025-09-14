import { SharedLayoutLoggedIn } from "@/components/SharedLayoutLoggedIn";
import { WrappedPasswordStrength } from "@/components/WrappedPasswordStrength";
import { zodResolver } from "@hookform/resolvers/zod";
import { useChangePasswordMutation, useSharedQuery } from "@repo/graphql";
import { extractError, getCodeFromError } from "@repo/lib";
import { Alert, Button, Form, InputControl } from "@repo/ui";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { CombinedError } from "urql";
import { z } from "zod";

const formSchema = z.object({
  oldPassword: z.string().min(1, "Please enter your current password"),
  password: z.string().min(1, "Please enter your new password"),
});
type FormInputs = z.infer<typeof formSchema>;

const Settings_Security = () => {
  const [error, setError] = useState<Error | CombinedError | null>(null);
  const query = useSharedQuery();

  const [{ data }, changePassword] = useChangePasswordMutation();
  const success = !!data?.changePassword?.success;

  const form = useForm<FormInputs>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      oldPassword: "",
      password: "",
    },
  });

  const onSubmit = useCallback(
    async (values: FormInputs) => {
      setError(null);
      try {
        await changePassword({
          oldPassword: values.oldPassword,
          newPassword: values.password,
        });
        form.reset();
        setError(null);
      } catch (e: any) {
        const code = getCodeFromError(e);
        if (code === "WEAKP") {
          form.setError("password", {
            type: "manual",
            message:
              "This password is too weak, please try a stronger password.",
          });
        } else if (code === "CREDS") {
          form.setError("oldPassword", {
            type: "manual",
            message: "Incorrect old password",
          });
        } else {
          setError(e);
        }
      }
    },
    [changePassword, form],
  );

  return (
    <SharedLayoutLoggedIn
      title="Security Settings"
      query={query}
      noHandleErrors
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="stack-col items-start gap-4">
            <h2 className="text-2xl font-bold">Change Password</h2>

            <InputControl
              control={form.control}
              name="oldPassword"
              label="Old/Current password"
              autoComplete="old-password password"
              type="password"
              data-cy="settingsecuritypage-input-password"
            />

            <InputControl
              control={form.control}
              name="password"
              label="New password"
              autoComplete="new-password"
              type="password"
              data-cy="settingsecuritypage-input-password2"
            />

            <div>
              <WrappedPasswordStrength password={form.watch("password")} />
            </div>

            {error ? (
              <Alert
                variant="destructive"
                title="Error: Failed to change password"
              >
                {extractError(error).message}
              </Alert>
            ) : null}

            {success ? (
              <Alert variant="success" title="Password changed!" />
            ) : null}

            <Button
              type="submit"
              variant="success"
              isLoading={form.formState.isSubmitting}
              data-cy="settingsecuritypage-submit-button"
            >
              Change Password
            </Button>
          </div>
        </form>
      </Form>
    </SharedLayoutLoggedIn>
  );
};

export default Settings_Security;
