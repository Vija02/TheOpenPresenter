import { Redirect } from "@/components/Redirect";
import { SharedLayoutLoggedIn } from "@/components/SharedLayoutLoggedIn";
import { ApolloError } from "@apollo/client";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Heading,
  VStack,
} from "@chakra-ui/react";
import {
  ProfileSettingsForm_UserFragment,
  useSettingsProfilePageQuery,
  useUpdateUserMutation,
} from "@repo/graphql";
import { extractError, getCodeFromError } from "@repo/lib";
import { ErrorAlert, LoadingFull } from "@repo/ui";
import { Form, Formik, FormikHelpers } from "formik";
import { InputControl, SubmitButton } from "formik-chakra-ui";
import { useCallback, useState } from "react";
import * as Yup from "yup";

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

const validationSchema = Yup.object({
  name: Yup.string().required("Please enter your name"),
  username: Yup.string()
    .min(2, "Username must be at least 2 characters long.")
    .matches(/^([a-zA-Z]|$)/, "Username must start with a letter.")
    .matches(
      /^([^_]|_[^_]|_$)*$/,
      "Username must not contain two underscores next to each other.",
    )
    .matches(
      /^[a-zA-Z0-9_]*$/,
      "Username must contain only alphanumeric characters and underscores.",
    )
    .required("Please enter a username"),
});
type FormInputs = Yup.InferType<typeof validationSchema>;

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

  const onSubmit = useCallback(
    async (values: FormInputs, formikHelpers: FormikHelpers<any>) => {
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
          formikHelpers.setFieldError(
            "username",
            "This username is already in use, please pick a different name",
          );
        } else {
          setError(e);
        }
      }
    },
    [setError, updateUser, user.id],
  );

  return (
    <Formik
      initialValues={{ name: user.name ?? "", username: user.username }}
      onSubmit={onSubmit}
      validationSchema={validationSchema}
    >
      {({ handleSubmit }) => (
        <Form onSubmit={handleSubmit as any}>
          <VStack alignItems="flex-start">
            <Heading>Profile Settings</Heading>
            <InputControl
              name="name"
              label="Name"
              inputProps={{
                autoComplete: "name",
                // @ts-ignore
                "data-cy": "settingsprofilepage-input-name",
              }}
            />

            <InputControl
              name="username"
              label="Username"
              inputProps={{
                autoComplete: "username",
                // @ts-ignore
                "data-cy": "settingsprofilepage-input-username",
              }}
            />

            {error ? (
              <Alert status="error">
                <AlertIcon />
                <Box flex="1">
                  <AlertTitle mr={2}>
                    Error: Failed to update profile
                  </AlertTitle>
                  <AlertDescription display="block">
                    {extractError(error).message}
                  </AlertDescription>
                </Box>
              </Alert>
            ) : null}

            {success ? (
              <Alert status="success">
                <AlertIcon />
                <Box flex="1">
                  <AlertTitle mr={2}>Profile updated</AlertTitle>
                </Box>
              </Alert>
            ) : null}

            <SubmitButton
              colorScheme="green"
              data-cy="settingsprofilepage-submit-button"
            >
              Update Profile
            </SubmitButton>
          </VStack>
        </Form>
      )}
    </Formik>
  );
}

export default Settings_Profile;
