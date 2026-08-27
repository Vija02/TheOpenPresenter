import { Redirect } from "@/components/Redirect";
import { SharedLayout } from "@/components/SharedLayout";
import { SocialLoginOptions } from "@/components/SocialLoginOptions";
import {
  Turnstile,
  TurnstileRef,
  getTurnstileSiteKey,
} from "@/components/Turnstile";
import { WrappedPasswordStrength } from "@/components/WrappedPasswordStrength";
import { useResetURQLClient } from "@/urql";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRegisterMutation, useSharedQuery } from "@repo/graphql";
import { extractError, getCodeFromError } from "@repo/lib";
import { captureEvent } from "@repo/observability/initAnalytics";
import { Alert, Button, Form, InputControl, Link } from "@repo/ui";
import { useCallback, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { CombinedError } from "urql";
import { Link as WouterLink, useLocation, useSearchParams } from "wouter";
import z from "zod";

const formSchema = z
  .object({
    name: z.string().min(1, "Please enter your name"),
    email: z.email("Please enter a valid email"),
    password: z.string().min(1, "Please enter your password"),
    confirm: z.string().min(1, "Please enter your password again"),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Make sure your password is the same in both password boxes.",
    path: ["confirm"],
  });
type FormInputs = z.infer<typeof formSchema>;

/**
 * The registration page just renders the standard layout and embeds the
 * registration form.
 */
const Register = () => {
  const [error, setError] = useState<Error | CombinedError | null>(null);
  const query = useSharedQuery();

  const [searchParams] = useSearchParams();
  const [, navigate] = useLocation();
  const email = searchParams.get("email");

  const [, register] = useRegisterMutation();
  const resetClient = useResetURQLClient();

  const captchaEnabled = !!getTurnstileSiteKey();
  const turnstileRef = useRef<TurnstileRef>(null);
  const turnstileTokenRef = useRef<string | null>(null);

  const redirectTo = "/o/";

  const form = useForm<FormInputs>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: email?.toString() ?? "",
      password: "",
      confirm: "",
    },
  });

  const onSubmit = useCallback(
    async (values: FormInputs) => {
      const turnstileToken = turnstileTokenRef.current;
      if (captchaEnabled && !turnstileToken) {
        setError(
          new Error("Please complete the captcha challenge before continuing."),
        );
        return;
      }
      setError(null);
      try {
        await register({
          email: values.email,
          password: values.password,
          name: values.name,
          turnstileToken,
        });
        captureEvent("user_registered");
        // Success: refetch
        resetClient();
        navigate(redirectTo);
      } catch (e: any) {
        turnstileTokenRef.current = null;
        turnstileRef.current?.reset();
        const code = getCodeFromError(e);
        if (code === "WEAKP") {
          form.setError("password", {
            message:
              "This password is too weak, please try a stronger password.",
          });
        } else if (code === "EMTKN") {
          form.setError("email", {
            message:
              "An account with this email address has already been registered. Please login or use the forgot password feature to retrive your account.",
          });
        } else {
          setError(e);
        }
      }
    },
    [register, resetClient, navigate, form, captchaEnabled],
  );

  return (
    <SharedLayout title="Register" query={query}>
      {({ currentUser }) =>
        currentUser ? (
          // Handle it here instead of shared layout so we can redirect properly
          <Redirect href={redirectTo} />
        ) : (
          <div className="flex justify-center px-4 py-12">
            <div className="max-w-sm w-full">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  <div className="stack-col items-start gap-4">
                    <h1 className="text-2xl font-bold text-center w-full">
                      Create your account
                    </h1>

                    <SocialLoginOptions next={redirectTo} />

                    <InputControl
                      control={form.control}
                      name="name"
                      label="Name"
                      autoComplete="name"
                      data-testid="registerpage-input-name"
                      autoFocus
                    />

                    <InputControl
                      control={form.control}
                      name="email"
                      label="E-mail"
                      type="email"
                      autoComplete="email"
                      data-testid="registerpage-input-email"
                    />

                    <InputControl
                      control={form.control}
                      name="password"
                      label="Password"
                      placeholder="Password"
                      type="password"
                      autoComplete="new-password"
                      data-testid="registerpage-input-password"
                    />

                    <WrappedPasswordStrength
                      password={form.watch("password")}
                    />

                    <InputControl
                      control={form.control}
                      name="confirm"
                      label="Confirm password"
                      placeholder="Password"
                      type="password"
                      autoComplete="new-password"
                      data-testid="registerpage-input-password2"
                    />

                    <Turnstile
                      ref={turnstileRef}
                      onToken={(token) => {
                        turnstileTokenRef.current = token;
                      }}
                    />

                    {error ? (
                      <Alert
                        variant="destructive"
                        title="Error: Failed to register"
                      >
                        {extractError(error).message}
                      </Alert>
                    ) : null}

                    <Button
                      type="submit"
                      variant="success"
                      isLoading={form.formState.isSubmitting}
                      data-testid="registerpage-submit-button"
                      className="w-full"
                    >
                      Register
                    </Button>

                    <div className="stack-col items-center w-full pt-2">
                      <Link asChild>
                        <WouterLink href="/login" className="text-sm">
                          Already have an account? Sign in
                        </WouterLink>
                      </Link>
                    </div>
                  </div>
                </form>
              </Form>
            </div>
          </div>
        )
      }
    </SharedLayout>
  );
};

export default Register;
