import { AuthRestrict, SharedLayout } from "@/components/SharedLayout";
import { ApolloError } from "@apollo/client";
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
import { useForgotPasswordMutation, useSharedQuery } from "@repo/graphql";
import { extractError } from "@repo/lib";
import { Form, Formik } from "formik";
import { InputControl, SubmitButton } from "formik-chakra-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link as WouterLink } from "wouter";
import * as Yup from "yup";

const validationSchema = Yup.object({
  email: Yup.string()
    .email("Please enter a valid email")
    .required("Please enter your email"),
});
type FormInputs = Yup.InferType<typeof validationSchema>;

const ForgotPassword = () => {
  const [error, setError] = useState<Error | ApolloError | null>(null);
  const query = useSharedQuery();

  const [forgotPassword] = useForgotPasswordMutation();
  const [successfulEmail, setSuccessfulEmail] = useState<string | null>(null);

  const onSubmit = useCallback(
    async (values: FormInputs) => {
      setError(null);
      try {
        const email = values.email;
        await forgotPassword({
          variables: {
            email,
          },
        });
        // Success: refetch
        setSuccessfulEmail(email);
      } catch (e: any) {
        setError(e);
      }
    },
    [forgotPassword, setError],
  );

  const focusElement = useRef<any>(null);
  useEffect(
    () => void (focusElement.current && focusElement.current!.focus()),
    [focusElement],
  );

  return (
    <SharedLayout
      title="Forgot Password"
      query={query}
      forbidWhen={AuthRestrict.LOGGED_IN}
    >
      <Flex justifyContent="center" marginTop={16}>
        <Box maxW="lg" w="100%">
          <Formik
            initialValues={{ email: "" }}
            onSubmit={onSubmit}
            validationSchema={validationSchema}
          >
            {({ handleSubmit }) => (
              <Form onSubmit={handleSubmit as any}>
                <VStack alignItems="flex-start">
                  <InputControl
                    // @ts-ignore
                    ref={focusElement}
                    name="email"
                    label="E-mail"
                    inputProps={{
                      placeholder: "Enter your e-mail",
                      autoComplete: "email",
                      // @ts-ignore
                      "data-cy": "forgotpage-input-username",
                    }}
                  />

                  <Link as={WouterLink} href="/login">
                    Remembered your password? Log in.
                  </Link>

                  {error ? (
                    <Alert status="error">
                      <AlertIcon />
                      <Box flex="1">
                        <AlertTitle mr={2}>Error</AlertTitle>
                        <AlertDescription display="block">
                          {extractError(error).message}
                        </AlertDescription>
                      </Box>
                    </Alert>
                  ) : null}

                  {!!successfulEmail && (
                    <Alert status="success">
                      <AlertIcon />
                      <Box flex="1">
                        <AlertTitle mr={2}>You've got mail</AlertTitle>
                        <AlertDescription display="block">
                          We've sent an email reset link to{" "}
                          <b>{successfulEmail}</b>.
                          <br />
                          Click the link and follow the instructions. If you
                          don't receive the link, please ensure you entered the
                          email address correctly, and check in your spam folder
                          just in case.
                        </AlertDescription>
                      </Box>
                    </Alert>
                  )}

                  <SubmitButton
                    colorScheme="green"
                    data-cy="forgotpage-button-submit"
                  >
                    Reset Password
                  </SubmitButton>
                </VStack>
              </Form>
            )}
          </Formik>
        </Box>
      </Flex>
    </SharedLayout>
  );
};

export default ForgotPassword;
