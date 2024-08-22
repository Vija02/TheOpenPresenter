import { SocialLoginOptions } from "@/components/SocialLoginOptions";
import { resetWebsocketConnection } from "@/lib/withApollo";
import { Box } from "@/styled-system/jsx";
import { ApolloError, useApolloClient } from "@apollo/client";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Link,
  VStack,
} from "@chakra-ui/react";
import { useLoginMutation } from "@repo/graphql";
import { extractError, getCodeFromError } from "@repo/lib";
import { Form, Formik, FormikHelpers } from "formik";
import { InputControl, SubmitButton } from "formik-chakra-ui";
import NextLink from "next/link";
import Router from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Yup from "yup";

export default function Home() {
  const [error, setError] = useState<Error | ApolloError | null>(null);
  return <LoginForm error={error} setError={setError} onSuccessRedirectTo="/o" />;
}

const validationSchema = Yup.object({
  username: Yup.string().required("Please enter your e-mail or username"),
  password: Yup.string().required("Please enter your password"),
});
type FormInputs = Yup.InferType<typeof validationSchema>;

interface LoginFormProps {
  onSuccessRedirectTo: string;
  error: Error | ApolloError | null;
  setError: (error: Error | ApolloError | null) => void;
}

function LoginForm({ onSuccessRedirectTo, error, setError }: LoginFormProps) {
  const [login] = useLoginMutation({});
  const client = useApolloClient();

  const onSubmit = useCallback(
    async (values: FormInputs, formikHelpers: FormikHelpers<any>) => {
      setError(null);
      try {
        await login({
          variables: {
            username: values.username,
            password: values.password,
          },
        });
        // Success: refetch
        resetWebsocketConnection();
        client.resetStore();
        Router.push(onSuccessRedirectTo);
      } catch (e: any) {
        const code = getCodeFromError(e);
        if (code === "CREDS") {
          formikHelpers.setFieldError(
            "password",
            "Incorrect username or password",
          );
        } else {
          setError(e);
        }
      }
    },
    [client, login, onSuccessRedirectTo, setError],
  );

  const focusElement = useRef<any>(null);
  useEffect(
    () => void (focusElement.current && focusElement.current!.focus()),
    [focusElement],
  );

  return (
    <Formik
      initialValues={{ username: "", password: "" }}
      onSubmit={onSubmit}
      validationSchema={validationSchema}
    >
      {({ handleSubmit }) => (
        <Form onSubmit={handleSubmit as any}>
          <VStack alignItems="flex-start">
            <InputControl
              // @ts-ignore
              ref={focusElement}
              name="username"
              label="E-mail or Username"
              inputProps={{
                placeholder: "Enter your e-mail or username",
                autoComplete: "email username",
                // @ts-ignore
                "data-cy": "loginpage-input-username",
              }}
            />

            <InputControl
              name="password"
              label="Password"
              inputProps={{
                placeholder: "Password",
                autoComplete: "current-password",
                type: "password",
                // @ts-ignore
                "data-cy": "loginpage-input-password",
              }}
            />

            <SocialLoginOptions next={onSuccessRedirectTo} />

            <Link as={NextLink} href="/forgot">
              Forgotten your password?
            </Link>

            <Link as={NextLink} href="/register">
              Don't have an account yet? Sign up
            </Link>

            {error ? (
              <Alert status="error">
                <AlertIcon />
                <Box flex="1">
                  <AlertTitle mr={2}>Error: Failed to sign in</AlertTitle>
                  <AlertDescription display="block">
                    {extractError(error).message}
                  </AlertDescription>
                </Box>
              </Alert>
            ) : null}

            <SubmitButton colorScheme="green" data-cy="loginpage-button-submit">
              Sign in
            </SubmitButton>
          </VStack>
        </Form>
      )}
    </Formik>
  );
}

export const getServerSideProps = async (context: any) => {
  if (context.req.user) {
    return {
      redirect: {
        destination: "/o",
        permanent: false,
      },
    };
  }

  return { props: {} };
};
