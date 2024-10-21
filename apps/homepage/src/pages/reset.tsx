import { AuthRestrict, SharedLayout } from "@/components/SharedLayout";
import { WrappedPasswordStrength } from "@/components/WrappedPasswordStrength";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Flex,
  Link,
  VStack,
} from "@chakra-ui/react";
import { useResetPasswordMutation, useSharedQuery } from "@repo/graphql";
import { extractError } from "@repo/lib";
import { Form, Formik } from "formik";
import { InputControl, SubmitButton } from "formik-chakra-ui";
import { NextPage } from "next";
import NextLink from "next/link";
import { useRouter } from "next/router";
import { default as React, useCallback, useState } from "react";
import * as Yup from "yup";

const validationSchema = Yup.object({
  token: Yup.string().required("Please enter your reset token"),
  password: Yup.string().required("Please enter your password"),
  confirm: Yup.string()
    .oneOf(
      [Yup.ref("password")],
      "Make sure your password is the same in both password boxes.",
    )
    .required("Please enter your password again"),
});
type FormInputs = Yup.InferType<typeof validationSchema>;

const ResetPage: NextPage = () => {
  const router = useRouter();
  const { user_id, token } = router.query;

  const [error, setError] = useState<Error | null>(null);
  const query = useSharedQuery();

  const [resetPassword, { data }] = useResetPasswordMutation();

  const success = !!data?.resetPassword?.success;

  const onSubmit = useCallback(
    async (values: FormInputs) => {
      setError(null);
      try {
        await resetPassword({
          variables: {
            userId: user_id?.toString(),
            token: values.token,
            password: values.password,
          },
        });
      } catch (e: any) {
        setError(e);
      }
    },
    [resetPassword, user_id],
  );

  return (
    <SharedLayout
      title="Reset Password"
      query={query}
      forbidWhen={
        // reset is used to change password of OAuth-authenticated users
        AuthRestrict.NEVER
      }
    >
      <Flex justifyContent="center" marginTop={16}>
        <Box maxW="lg" w="100%">
          {success && (
            <Alert status="success">
              <AlertIcon />
              <Box flex="1">
                <AlertTitle mr={2}>Password successfully reset</AlertTitle>
                <AlertDescription display="block">
                  Your password was reset. You can go and{" "}
                  <NextLink href="/login" passHref>
                    <Link>log in</Link>
                  </NextLink>{" "}
                  now
                </AlertDescription>
              </Box>
            </Alert>
          )}
          {!success && (
            <Formik
              initialValues={{
                token: token?.toString() ?? "",
                password: "",
                confirm: "",
              }}
              onSubmit={onSubmit}
              validationSchema={validationSchema}
            >
              {({ handleSubmit }) => (
                <Form onSubmit={handleSubmit as any}>
                  <VStack alignItems="flex-start">
                    <InputControl
                      name="token"
                      label="Enter your reset token:"
                      inputProps={{
                        // @ts-ignore
                        "data-cy": "resetpage-input-token",
                      }}
                    />

                    <InputControl
                      name="password"
                      label="Password"
                      inputProps={{
                        placeholder: "Password",
                        autoComplete: "new-password",
                        type: "password",
                        // @ts-ignore
                        "data-cy": "resetpage-input-password",
                      }}
                    />

                    <WrappedPasswordStrength />

                    <InputControl
                      name="confirm"
                      label="Confirm password"
                      inputProps={{
                        placeholder: "Password",
                        autoComplete: "new-password",
                        type: "password",
                        // @ts-ignore
                        "data-cy": "resetpage-input-password2",
                      }}
                    />

                    {error ? (
                      <Alert status="error">
                        <AlertIcon />
                        <Box flex="1">
                          <AlertTitle mr={2}>
                            Error: Failed to reset password
                          </AlertTitle>
                          <AlertDescription display="block">
                            {extractError(error).message}
                          </AlertDescription>
                        </Box>
                      </Alert>
                    ) : null}

                    <SubmitButton
                      colorScheme="green"
                      data-cy="resetpage-button-submit"
                    >
                      Reset password
                    </SubmitButton>
                  </VStack>
                </Form>
              )}
            </Formik>
          )}
        </Box>
      </Flex>
    </SharedLayout>
  );
};

export default ResetPage;
