import { Redirect } from "@/components/Redirect";
import { SharedLayout } from "@/components/SharedLayout";
import { SocialLoginOptions } from "@/components/SocialLoginOptions";
import { useResetURQLClient } from "@/urql";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLoginMutation, useSharedQuery } from "@repo/graphql";
import { extractError, getCodeFromError } from "@repo/lib";
import { captureEvent } from "@repo/observability/initAnalytics";
import {
  Alert,
  Button,
  CheckboxControl,
  Form,
  InputControl,
  Link,
} from "@repo/ui";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { CombinedError } from "urql";
import { Link as WouterLink, useLocation, useSearchParams } from "wouter";
import z from "zod";

export function isSafe(nextUrl: string | null) {
  return (nextUrl && nextUrl[0] === "/") || false;
}

export default function Home() {
  const [error, setError] = useState<Error | CombinedError | null>(null);
  const query = useSharedQuery();

  const [searchParams] = useSearchParams();
  const rawNext = searchParams.get("next");
  const hasKiosk = searchParams.has("kiosk");

  const next: string = isSafe(rawNext?.toString() ?? null)
    ? rawNext!.toString()
    : "/o/";

  return (
    <SharedLayout title="Register" query={query}>
      {({ currentUser }) =>
        currentUser ? (
          // Handle it here instead of shared layout so we can redirect properly
          <Redirect href={next} />
        ) : (
          <div className="flex justify-center px-4 py-12">
            <div className="max-w-sm w-full">
              <h1 className="text-2xl font-bold text-center mb-6">
                Sign in to TheOpenPresenter
              </h1>
              <LoginForm
                error={error}
                setError={setError}
                onSuccessRedirectTo={next}
                autoOpenQRLogin={hasKiosk}
              />
            </div>
          </div>
        )
      }
    </SharedLayout>
  );
}

const formSchema = z.object({
  username: z.string().min(1, "Please enter your e-mail"),
  password: z.string().min(1, "Please enter your password"),
  rememberMe: z.boolean().default(true),
});
type FormInputs = z.infer<typeof formSchema>;

interface LoginFormProps {
  onSuccessRedirectTo: string;
  error: Error | CombinedError | null;
  setError: (error: Error | CombinedError | null) => void;
  autoOpenQRLogin?: boolean;
}

function LoginForm({
  onSuccessRedirectTo,
  error,
  setError,
  autoOpenQRLogin,
}: LoginFormProps) {
  const [, login] = useLoginMutation();
  const [, navigate] = useLocation();

  const resetClient = useResetURQLClient();

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
      rememberMe: true,
    },
  });

  const rememberMe = form.watch("rememberMe");

  const onSubmit = useCallback(
    async (values: FormInputs) => {
      setError(null);
      try {
        await login(
          {
            username: values.username,
            password: values.password,
          },
          {
            fetchOptions: {
              headers: values.rememberMe ? { "persist-session": "1" } : {},
            },
          },
        );
        captureEvent("user_logged_in");
        // Success: refetch
        resetClient();
        navigate(onSuccessRedirectTo);
      } catch (e: any) {
        const code = getCodeFromError(e);
        if (code === "CREDS") {
          form.setError("password", {
            type: "manual",
            message: "Incorrect e-mail or password",
          });
        } else {
          setError(e);
        }
      }
    },
    [setError, login, resetClient, navigate, onSuccessRedirectTo, form],
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="stack-col items-start gap-4">
          <SocialLoginOptions
            next={onSuccessRedirectTo}
            persistSession={rememberMe}
            autoOpenQRLogin={autoOpenQRLogin}
          />

          <InputControl
            control={form.control}
            name="username"
            label="E-mail"
            placeholder="Enter your e-mail"
            autoComplete="email username"
            data-testid="loginpage-input-username"
            autoFocus
          />
          <InputControl
            control={form.control}
            name="password"
            label="Password"
            labelSuffix={
              <Link asChild>
                <WouterLink href="/forgot" className="text-sm">
                  Forgot password?
                </WouterLink>
              </Link>
            }
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            data-testid="loginpage-input-password"
          />

          <CheckboxControl
            control={form.control}
            name="rememberMe"
            label="Keep me signed in"
            data-testid="loginpage-input-rememberme"
          />

          {error ? (
            <Alert variant="destructive" title="Login failed">
              {extractError(error).message}
            </Alert>
          ) : null}

          <Button
            type="submit"
            variant="success"
            isLoading={form.formState.isSubmitting}
            className="w-full"
          >
            Sign in
          </Button>

          <div className="stack-col items-center gap-1 w-full pt-2">
            <Link asChild>
              <WouterLink href="/register" className="text-sm">
                Don't have an account yet? Sign up
              </WouterLink>
            </Link>
          </div>
        </div>
      </form>
    </Form>
  );
}
