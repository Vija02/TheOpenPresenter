import { SharedLayoutLoggedIn } from "@/components/SharedLayoutLoggedIn";
import { WrappedPasswordStrength } from "@/components/WrappedPasswordStrength";
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
import { useChangePasswordMutation, useSharedQuery } from "@repo/graphql";
import { extractError, getCodeFromError } from "@repo/lib";
import { Form, Formik, FormikHelpers } from "formik";
import { InputControl, SubmitButton } from "formik-chakra-ui";
import { NextPage } from "next";
import React, { useCallback, useState } from "react";
import * as Yup from "yup";

const validationSchema = Yup.object({
  oldPassword: Yup.string().required("Please enter your current password"),
  password: Yup.string().required("Please enter your new password"),
});
type FormInputs = Yup.InferType<typeof validationSchema>;

const Settings_Security: NextPage = () => {
  const [error, setError] = useState<Error | ApolloError | null>(null);
  const query = useSharedQuery();

  const [changePassword, { data }] = useChangePasswordMutation();
  const success = !!data?.changePassword?.success;

  const onSubmit = useCallback(
    async (values: FormInputs, formikHelpers: FormikHelpers<any>) => {
      setError(null);
      try {
        await changePassword({
          variables: {
            oldPassword: values.oldPassword,
            newPassword: values.password,
          },
        });
        formikHelpers.resetForm();
        setError(null);
      } catch (e: any) {
        const code = getCodeFromError(e);
        if (code === "WEAKP") {
          formikHelpers.setFieldError(
            "password",
            "This password is too weak, please try a stronger password.",
          );
        } else if (code === "CREDS") {
          formikHelpers.setFieldError("oldPassword", "Incorrect old password");
        } else {
          setError(e);
        }
      }
    },
    [changePassword],
  );

  return (
    <SharedLayoutLoggedIn
      title="Security Settings"
      query={query}
      noHandleErrors
    >
      <Formik
        initialValues={{
          oldPassword: "",
          password: "",
        }}
        onSubmit={onSubmit}
        validationSchema={validationSchema}
      >
        {({ handleSubmit }) => (
          <Form onSubmit={handleSubmit as any}>
            <VStack alignItems="flex-start">
              <Heading>Change Password</Heading>
              <InputControl
                name="oldPassword"
                label="Old/Current password"
                inputProps={{
                  autoComplete: "old-password password",
                  type: "password",
                  // @ts-ignore
                  "data-cy": "settingsecuritypage-input-password",
                }}
              />

              <InputControl
                name="password"
                label="New password"
                inputProps={{
                  autoComplete: "new-password",
                  type: "password",
                  // @ts-ignore
                  "data-cy": "settingsecuritypage-input-password2",
                }}
              />

              <WrappedPasswordStrength />

              {error ? (
                <Alert status="error">
                  <AlertIcon />
                  <Box flex="1">
                    <AlertTitle mr={2}>
                      Error: Failed to change password
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
                    <AlertTitle mr={2}>Password changed!</AlertTitle>
                  </Box>
                </Alert>
              ) : null}

              <SubmitButton
                colorScheme="green"
                data-cy="settingsecuritypage-submit-button"
              >
                Change Password
              </SubmitButton>
            </VStack>
          </Form>
        )}
      </Formik>
    </SharedLayoutLoggedIn>
  );
};

export default Settings_Security;
