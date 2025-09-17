import { Redirect } from "@/components/Redirect";
import { AuthRestrict, SharedLayout } from "@/components/SharedLayout";
import { WrappedPasswordStrength } from "@/components/WrappedPasswordStrength";
import { zodResolver } from "@hookform/resolvers/zod";
import { useResetPasswordMutation, useSharedQuery } from "@repo/graphql";
import { extractError } from "@repo/lib";
import { Alert, Button, Form, InputControl, Link } from "@repo/ui";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { Link as WouterLink } from "wouter";
import { useSearchParams } from "wouter";
import { z } from "zod";

const formSchema = z
  .object({
    token: z.string().min(1, "Please enter your reset token"),
    password: z.string().min(1, "Please enter your password"),
    confirm: z.string().min(1, "Please enter your password again"),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Make sure your password is the same in both password boxes.",
    path: ["confirm"],
  });
type FormInputs = z.infer<typeof formSchema>;

const ResetPage = () => {
  const [searchParams] = useSearchParams();
  const user_id = searchParams.get("user_id");
  const token = searchParams.get("token");

  const [error, setError] = useState<Error | null>(null);
  const query = useSharedQuery();

  const [{ data }, resetPassword] = useResetPasswordMutation();

  const success = !!data?.resetPassword?.success;

  const form = useForm<FormInputs>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      token: token?.toString() ?? "",
      password: "",
      confirm: "",
    },
  });

  const onSubmit = useCallback(
    async (values: FormInputs) => {
      setError(null);
      try {
        await resetPassword({
          userId: user_id?.toString(),
          token: values.token,
          password: values.password,
        });
      } catch (e: any) {
        setError(e);
      }
    },
    [resetPassword, user_id],
  );

  if (!user_id) {
    return <Redirect href="/login" />;
  }

  return (
    <SharedLayout
      title="Reset Password"
      query={query}
      forbidWhen={
        // reset is used to change password of OAuth-authenticated users
        AuthRestrict.NEVER
      }
    >
      <div className="flex justify-center mt-16">
        <div className="max-w-md w-full">
          {success && (
            <Alert variant="success" title="Password successfully reset">
              Your password was reset. You can go and{" "}
              <Link asChild>
                <WouterLink href="/login" className="text-sm">
                  log in
                </WouterLink>
              </Link>{" "}
              now
            </Alert>
          )}
          {!success && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <div className="stack-col items-start gap-4">
                  <InputControl
                    control={form.control}
                    name="token"
                    label="Enter your reset token:"
                    data-cy="resetpage-input-token"
                  />

                  <InputControl
                    control={form.control}
                    name="password"
                    label="Password"
                    placeholder="Password"
                    autoComplete="new-password"
                    type="password"
                    data-cy="resetpage-input-password"
                  />

                  <WrappedPasswordStrength password={form.watch("password")} />

                  <InputControl
                    control={form.control}
                    name="confirm"
                    label="Confirm password"
                    placeholder="Password"
                    autoComplete="new-password"
                    type="password"
                    data-cy="resetpage-input-password2"
                  />

                  {error ? (
                    <Alert
                      variant="destructive"
                      title="Error: Failed to reset password"
                    >
                      {extractError(error).message}
                    </Alert>
                  ) : null}

                  <Button
                    type="submit"
                    variant="success"
                    isLoading={form.formState.isSubmitting}
                    data-cy="resetpage-button-submit"
                    className="w-full"
                  >
                    Reset password
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </div>
      </div>
    </SharedLayout>
  );
};

export default ResetPage;
