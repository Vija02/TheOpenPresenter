import { SharedLayout } from "@/components/SharedLayout";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSharedQuery, useVerifyEmailMutation } from "@repo/graphql";
import { extractError } from "@repo/lib";
import { Alert, Button, Form, InputControl } from "@repo/ui";
import React, { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "wouter";
import z from "zod";

const formSchema = z.object({
  code: z.string().min(1, "Please enter your verification code"),
});
type FormInputs = z.infer<typeof formSchema>;

const VerifyPage = () => {
  const [searchParams] = useSearchParams();
  const rawId = searchParams.get("id");
  const rawToken = searchParams.get("token");

  const initialShouldSubmit = !!rawId && !!rawToken;

  const [error, setError] = React.useState<Error | null>(null);
  const [verifyEmail, { data, loading }] = useVerifyEmailMutation();

  const success = !!data?.verifyEmail?.success;

  useEffect(() => {
    if (initialShouldSubmit) {
      setError(null);
      verifyEmail({
        variables: {
          id: rawId.toString(),
          token: rawToken.toString()!,
        },
      }).catch((e: Error) => {
        setError(e);
      });
    }
  }, [initialShouldSubmit, rawId, rawToken, verifyEmail]);

  const form = useForm<FormInputs>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
    },
  });

  const onSubmit = useCallback(
    async (values: FormInputs) => {
      setError(null);
      try {
        await verifyEmail({
          variables: {
            id: rawId,
            token: values.code,
          },
        });
      } catch (e: any) {
        setError(e);
      }
    },
    [rawId, verifyEmail],
  );

  const query = useSharedQuery();
  return (
    <SharedLayout title="Verify Email Address" query={query}>
      <div className="flex justify-center mt-10">
        <div className="max-w-md w-full">
          {((!initialShouldSubmit && !success) || !!error) && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <div className="stack-col items-start gap-4">
                  <InputControl
                    control={form.control}
                    name="code"
                    label="Please enter your email verification code"
                    data-cy="verifypage-input-code"
                  />

                  {error ? (
                    <Alert
                      variant="destructive"
                      title="Error: Failed to verify email"
                    >
                      {extractError(error).message}
                    </Alert>
                  ) : null}

                  <Button
                    type="submit"
                    variant="success"
                    isLoading={form.formState.isSubmitting}
                    data-cy="verifypage-button-submit"
                    className="w-full"
                  >
                    Submit
                  </Button>
                </div>
              </form>
            </Form>
          )}
          {loading && <div className="text-center py-4">Verifying...</div>}
          {success && (
            <Alert variant="success" title="Email Verified">
              Thank you for verifying your email address. You may now close this
              window.
            </Alert>
          )}
        </div>
      </div>
    </SharedLayout>
  );
};

export default VerifyPage;
