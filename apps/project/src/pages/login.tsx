import { Redirect } from "@/components/Redirect";
import { SharedLayout } from "@/components/SharedLayout";
import { SocialLoginOptions } from "@/components/SocialLoginOptions";
import { useResetURQLClient } from "@/urql";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLoginMutation, useSharedQuery } from "@repo/graphql";
import { extractError, getCodeFromError } from "@repo/lib";
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
          <div className="flex justify-center mt-16">
            <div className="max-w-md w-full">
              <h1 className="text-2xl font-bold mb-4">Login</h1>
              <LoginForm
                error={error}
                setError={setError}
                onSuccessRedirectTo={next}
              />
            </div>
          </div>
        )
      }
    </SharedLayout>
  );
}

const formSchema = z.object({
  username: z.string().min(1, "Please enter your e-mail or username"),
  password: z.string().min(1, "Please enter your password"),
  rememberMe: z.boolean().default(false),
});
type FormInputs = z.infer<typeof formSchema>;

interface LoginFormProps {
  onSuccessRedirectTo: string;
  error: Error | CombinedError | null;
  setError: (error: Error | CombinedError | null) => void;
}

function LoginForm({ onSuccessRedirectTo, error, setError }: LoginFormProps) {
  const [, login] = useLoginMutation();
  const [, navigate] = useLocation();

  const resetClient = useResetURQLClient();

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
      rememberMe: false,
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
              headers: values.rememberMe
                ? { "persist-session": "1" }
                : {},
            },
          },
        );
        // Success: refetch
        resetClient();
        navigate(onSuccessRedirectTo);
      } catch (e: any) {
        const code = getCodeFromError(e);
        if (code === "CREDS") {
          form.setError("password", {
            type: "manual",
            message: "Incorrect username or password",
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
          <InputControl
            control={form.control}
            name="username"
            label="E-mail or Username"
            placeholder="Enter your e-mail or username"
            autoComplete="email username"
            data-cy="loginpage-input-username"
            autoFocus
          />
          <InputControl
            control={form.control}
            name="password"
            label="Password"
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            data-cy="loginpage-input-password"
          />

          <CheckboxControl
            control={form.control}
            name="rememberMe"
            label="Remember me"
            data-cy="loginpage-input-rememberme"
          />

          <div className="stack-col items-start gap-2">
            <Link asChild>
              <WouterLink href="/forgot" className="text-sm">
                Forgotten your password?
              </WouterLink>
            </Link>

            <Link asChild>
              <WouterLink href="/register" className="text-sm">
                Don't have an account yet? Sign up
              </WouterLink>
            </Link>
          </div>

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

          <p className="lineText w-full text-gray-700">Or continue with</p>

          <SocialLoginOptions next={onSuccessRedirectTo} persistSession={rememberMe} />
        </div>
      </form>
    </Form>
  );
}
