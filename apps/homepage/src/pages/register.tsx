import { Redirect } from "@/components/Redirect";
import { SharedLayout } from "@/components/SharedLayout";
import { WrappedPasswordStrength } from "@/components/WrappedPasswordStrength";
import { resetWebsocketConnection } from "@/lib/withApollo";
import { ApolloError, useApolloClient } from "@apollo/client";
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
import { useRegisterMutation, useSharedQuery } from "@repo/graphql";
import {
  extractError,
  getCodeFromError,
  getExceptionFromError,
} from "@repo/lib";
import { Form, Formik, FormikHelpers } from "formik";
import { InputControl, SubmitButton } from "formik-chakra-ui";
import { NextPage } from "next";
import NextLink from "next/link";
import Router, { useRouter } from "next/router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import * as Yup from "yup";

const validationSchema = Yup.object({
  name: Yup.string().required("Please enter your name"),
  username: Yup.string()
    .min(2, "Username must be at least 2 characters long.")
    .max(24, "Username must be at most 24 characters long.")
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
  email: Yup.string()
    .email("Please enter a valid email")
    .required("Please enter your email"),
  password: Yup.string().required("Please enter your password"),
  confirm: Yup.string()
    .oneOf(
      [Yup.ref("password")],
      "Make sure your password is the same in both password boxes.",
    )
    .required("Please enter your password again"),
});
type FormInputs = Yup.InferType<typeof validationSchema>;

/**
 * The registration page just renders the standard layout and embeds the
 * registration form.
 */
const Register: NextPage = () => {
  const [error, setError] = useState<Error | ApolloError | null>(null);
  const query = useSharedQuery();

  const router = useRouter();
  const { email } = router.query;

  const [register] = useRegisterMutation({});
  const client = useApolloClient();

  let redirectTo = "/o/";

  const onSubmit = useCallback(
    async (values: FormInputs, formikHelpers: FormikHelpers<any>) => {
      try {
        await register({
          variables: {
            username: values.username,
            email: values.email,
            password: values.password,
            name: values.name,
          },
        });
        // Success: refetch
        resetWebsocketConnection();
        client.resetStore();
        Router.push(redirectTo);
      } catch (e: any) {
        const code = getCodeFromError(e);
        const exception = getExceptionFromError(e);
        const fields: any = exception && "fields" in exception;
        if (code === "WEAKP") {
          formikHelpers.setFieldError(
            "password",
            "This password is too weak, please try a stronger password.",
          );
        } else if (code === "EMTKN") {
          formikHelpers.setFieldError(
            "email",
            "An account with this email address has already been registered. Please login or use the forgot password feature to retrive your account.",
          );
        } else if (code === "NUNIQ" && fields && fields[0] === "username") {
          formikHelpers.setFieldError(
            "username",
            "An account with this username has already been registered, please try a different username.",
          );
        } else if (code === "23514") {
          formikHelpers.setFieldError(
            "username",
            "This username is not allowed; usernames must be between 2 and 24 characters long (inclusive), must start with a letter, and must contain only alphanumeric characters and underscores.",
          );
        } else {
          setError(e);
        }
      }
    },
    [register, client, redirectTo],
  );

  const focusElement = useRef<HTMLInputElement>(null);
  useEffect(
    () => void (focusElement.current && focusElement.current!.focus()),
    [focusElement],
  );

  return (
    <SharedLayout title="Register" query={query}>
      {({ currentUser }) =>
        currentUser ? (
          // Handle it here instead of shared layout so we can redirect properly
          <Redirect href={redirectTo} />
        ) : (
          <Flex justifyContent="center" marginTop={16}>
            <Box maxW="lg" w="100%">
              <Formik
                initialValues={{
                  name: "",
                  username: "",
                  email: email?.toString() ?? "",
                  password: "",
                  confirm: "",
                }}
                onSubmit={onSubmit}
                validationSchema={validationSchema}
              >
                {({ handleSubmit, setFieldValue }) => (
                  <Form onSubmit={handleSubmit as any}>
                    <VStack alignItems="flex-start">
                      <InputControl
                        // @ts-ignore
                        ref={focusElement}
                        name="name"
                        label="Name"
                        inputProps={{
                          onChange: (e) => {
                            const newValue = e.target.value as string;
                            const newUsername = newValue
                              .toLowerCase()
                              .replace(/\s\s+/g, " ")
                              .replace(/ /g, "_");

                            setFieldValue("name", newValue);
                            setFieldValue("username", newUsername);
                          },
                          autoComplete: "name",
                          // @ts-ignore
                          "data-cy": "registerpage-input-name",
                          onBlur: (e) =>
                            e.relatedTarget?.tagName === "a" &&
                            e.stopPropagation(),
                        }}
                      />

                      <InputControl
                        name="username"
                        label="Username"
                        inputProps={{
                          autoComplete: "username",
                          // @ts-ignore
                          "data-cy": "registerpage-input-username",
                        }}
                      />

                      <InputControl
                        name="email"
                        label="E-mail"
                        inputProps={{
                          autoComplete: "email",
                          type: "email",
                          // @ts-ignore
                          "data-cy": "registerpage-input-email",
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
                          "data-cy": "registerpage-input-password",
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
                          "data-cy": "registerpage-input-password2",
                        }}
                      />

                      <Link as={NextLink} href="/login">
                        Already have an account? Sign in
                      </Link>

                      {error ? (
                        <Alert status="error">
                          <AlertIcon />
                          <Box flex="1">
                            <AlertTitle mr={2}>
                              Error: Failed to register
                            </AlertTitle>
                            <AlertDescription display="block">
                              {extractError(error).message}
                            </AlertDescription>
                          </Box>
                        </Alert>
                      ) : null}

                      <SubmitButton
                        colorScheme="green"
                        data-cy="registerpage-submit-button"
                      >
                        Register
                      </SubmitButton>
                    </VStack>
                  </Form>
                )}
              </Formik>
            </Box>
          </Flex>
        )
      }
    </SharedLayout>
  );
};

export default Register;
