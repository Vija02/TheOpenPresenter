import { AuthRestrict, SharedLayout } from "@/components/SharedLayout";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForgotPasswordMutation, useSharedQuery } from "@repo/graphql";
import { extractError } from "@repo/lib";
import { Alert, Button, Form, InputControl, Link } from "@repo/ui";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { CombinedError } from "urql";
import { Link as WouterLink } from "wouter";
import { z } from "zod";

const formSchema = z.object({
  email: z.string().email("Please enter a valid email"),
});

type FormInputs = z.infer<typeof formSchema>;

const ForgotPassword = () => {
  const [error, setError] = useState<Error | CombinedError | null>(null);
  const query = useSharedQuery();

  const [, forgotPassword] = useForgotPasswordMutation();
  const [successfulEmail, setSuccessfulEmail] = useState<string | null>(null);

  const form = useForm<FormInputs>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = useCallback(
    async (values: FormInputs) => {
      setError(null);
      try {
        const email = values.email;
        await forgotPassword({
          email,
        });
        // Success: refetch
        setSuccessfulEmail(email);
      } catch (e: any) {
        setError(e);
      }
    },
    [forgotPassword],
  );

  return (
    <SharedLayout
      title="Forgot Password"
      query={query}
      forbidWhen={AuthRestrict.LOGGED_IN}
    >
      <div className="flex justify-center mt-16">
        <div className="max-w-md w-full">
          <h1 className="text-2xl font-bold mb-4">Reset password</h1>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="stack-col items-start"
            >
              <InputControl
                control={form.control}
                name="email"
                label="E-mail"
                placeholder="Enter your e-mail"
                autoComplete="email"
                data-testid="forgotpage-input-username"
                autoFocus
              />

              <Link asChild>
                <WouterLink href="/login">
                  Remembered your password? Log in.
                </WouterLink>
              </Link>

              {error ? (
                <Alert variant="destructive" title="Error">
                  {extractError(error).message}
                </Alert>
              ) : null}

              {!!successfulEmail && (
                <Alert variant="success" title="You've got mail">
                  We've sent an email reset link to <b>{successfulEmail}</b>.
                  <br />
                  Click the link and follow the instructions. If you don't
                  receive the link, please ensure you entered the email address
                  correctly, and check in your spam folder just in case.
                </Alert>
              )}

              <Button
                type="submit"
                variant="success"
                data-testid="forgotpage-button-submit"
              >
                Reset Password
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </SharedLayout>
  );
};

export default ForgotPassword;
