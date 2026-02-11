import { Redirect } from "@/components/Redirect";
import { SharedLayout } from "@/components/SharedLayout";
import { WrappedPasswordStrength } from "@/components/WrappedPasswordStrength";
import { useResetURQLClient } from "@/urql";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRegisterMutation, useSharedQuery } from "@repo/graphql";
import {
  extractError,
  getCodeFromError,
  getExceptionFromError,
} from "@repo/lib";
import { Alert, Button, Form, InputControl, Link } from "@repo/ui";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { CombinedError } from "urql";
import { Link as WouterLink, useLocation, useSearchParams } from "wouter";
import z from "zod";

const formSchema = z
  .object({
    name: z.string().min(1, "Please enter your name"),
    username: z
      .string()
      .min(2, "Username must be at least 2 characters long.")
      .max(24, "Username must be at most 24 characters long.")
      .regex(/^([a-zA-Z]|$)/, "Username must start with a letter.")
      .regex(
        /^([^_]|_[^_]|_$)*$/,
        "Username must not contain two underscores next to each other.",
      )
      .regex(
        /^[a-zA-Z0-9_]*$/,
        "Username must contain only alphanumeric characters and underscores.",
      ),
    email: z.string().email("Please enter a valid email"),
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

  const redirectTo = "/o/";

  const form = useForm<FormInputs>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      username: "",
      email: email?.toString() ?? "",
      password: "",
      confirm: "",
    },
  });

  const onSubmit = useCallback(
    async (values: FormInputs) => {
      try {
        await register({
          username: values.username,
          email: values.email,
          password: values.password,
          name: values.name,
        });
        // Success: refetch
        resetClient();
        navigate(redirectTo);
      } catch (e: any) {
        const code = getCodeFromError(e);
        const exception = getExceptionFromError(e);
        const fields: any =
          exception && "fields" in exception && exception.fields;
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
        } else if (code === "NUNIQ" && fields && fields[0] === "username") {
          form.setError("username", {
            message:
              "An account with this username has already been registered, please try a different username.",
          });
        } else if (code === "23514") {
          form.setError("username", {
            message:
              "This username is not allowed; usernames must be between 2 and 24 characters long (inclusive), must start with a letter, and must contain only alphanumeric characters and underscores.",
          });
        } else {
          setError(e);
        }
      }
    },
    [register, resetClient, navigate, form],
  );

  return (
    <SharedLayout title="Register" query={query}>
      {({ currentUser }) =>
        currentUser ? (
          // Handle it here instead of shared layout so we can redirect properly
          <Redirect href={redirectTo} />
        ) : (
          <div className="flex justify-center mt-16">
            <div className="max-w-md w-full">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  <div className="stack-col items-start gap-4">
                    <h1 className="text-2xl font-bold">Register</h1>
                    <InputControl
                      control={form.control}
                      name="name"
                      label="Name"
                      autoComplete="name"
                      data-testid="registerpage-input-name"
                      onChange={(e) => {
                        const newValue = e.target.value as string;
                        const newUsername = newValue
                          .toLowerCase()
                          .replace(/\s\s+/g, " ")
                          .replace(/ /g, "_");

                        form.setValue("name", newValue);
                        form.setValue("username", newUsername);
                      }}
                      autoFocus
                    />

                    <InputControl
                      control={form.control}
                      name="username"
                      label="Username"
                      autoComplete="username"
                      data-testid="registerpage-input-username"
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

                    <Link asChild>
                      <WouterLink href="/login" className="text-sm">
                        Already have an account? Sign in
                      </WouterLink>
                    </Link>

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
