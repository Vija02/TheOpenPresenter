import { Redirect } from "@/components/Redirect";
import { SharedLayoutLoggedIn } from "@/components/SharedLayoutLoggedIn";
import { ApolloError } from "@apollo/client";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ProfileSettingsForm_UserFragment,
  useSettingsProfilePageQuery,
  useUpdateUserMutation,
} from "@repo/graphql";
import { extractError, getCodeFromError } from "@repo/lib";
import { ErrorAlert, LoadingFull } from "@repo/ui";
import { Alert, Button, Form, InputControl } from "@repo/ui";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const validationSchema = z.object({
  name: z.string().min(1, "Please enter your name"),
  username: z
    .string()
    .min(2, "Username must be at least 2 characters long.")
    .regex(/^([a-zA-Z]|$)/, "Username must start with a letter.")
    .regex(
      /^([^_]|_[^_]|_$)*$/,
      "Username must not contain two underscores next to each other.",
    )
    .regex(
      /^[a-zA-Z0-9_]*$/,
      "Username must contain only alphanumeric characters and underscores.",
    ),
});

type FormInputs = z.infer<typeof validationSchema>;

const Settings_Profile = () => {
  const [formError, setFormError] = useState<Error | ApolloError | null>(null);
  const query = useSettingsProfilePageQuery();
  const { data, loading, error } = query;
  return (
    <SharedLayoutLoggedIn title="Profile Settings" query={query} noHandleErrors>
      {data && data.currentUser ? (
        <ProfileSettingsForm
          error={formError}
          setError={setFormError}
          user={data.currentUser}
        />
      ) : loading ? (
        <LoadingFull />
      ) : error ? (
        <ErrorAlert error={error} />
      ) : (
        <Redirect href={`/login?next=${encodeURIComponent("/settings")}`} />
      )}
    </SharedLayoutLoggedIn>
  );
};

interface ProfileSettingsFormProps {
  user: ProfileSettingsForm_UserFragment;
  error: Error | ApolloError | null;
  setError: (error: Error | ApolloError | null) => void;
}

function ProfileSettingsForm({
  user,
  error,
  setError,
}: ProfileSettingsFormProps) {
  const [updateUser, { data }] = useUpdateUserMutation();
  const success = !!data?.updateUser;

  const form = useForm<FormInputs>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      name: user.name ?? "",
      username: user.username,
    },
  });

  const onSubmit = useCallback(
    async (values: FormInputs) => {
      setError(null);
      try {
        await updateUser({
          variables: {
            id: user.id,
            patch: {
              username: values.username,
              name: values.name,
            },
          },
        });
        setError(null);
      } catch (e: any) {
        const errcode = getCodeFromError(e);
        if (errcode === "23505" || errcode === "NUNIQ") {
          form.setError("username", {
            type: "manual",
            message:
              "This username is already in use, please pick a different name",
          });
        } else {
          setError(e);
        }
      }
    },
    [form, setError, updateUser, user.id],
  );

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="stack-col items-start gap-4"
      >
        <h1 className="text-2xl font-bold">Profile Settings</h1>

        <InputControl
          control={form.control}
          name="name"
          label="Name"
          autoComplete="name"
          data-cy="settingsprofilepage-input-name"
        />

        <InputControl
          control={form.control}
          name="username"
          label="Username"
          autoComplete="username"
          data-cy="settingsprofilepage-input-username"
        />

        {error ? (
          <Alert variant="destructive" title="Error: Failed to update profile">
            {extractError(error).message}
          </Alert>
        ) : null}

        {success ? <Alert variant="success" title="Profile updated" /> : null}

        <Button
          type="submit"
          variant="success"
          isLoading={form.formState.isSubmitting}
          data-cy="settingsprofilepage-submit-button"
        >
          Update Profile
        </Button>
      </form>
    </Form>
  );
}

export default Settings_Profile;
