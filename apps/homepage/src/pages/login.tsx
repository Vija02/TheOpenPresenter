import { Redirect } from "@/components/Redirect";
import { SharedLayout } from "@/components/SharedLayout";
import { SocialLoginOptions } from "@/components/SocialLoginOptions";
import { resetWebsocketConnection } from "@/lib/withApollo";
import { ApolloError, useApolloClient } from "@apollo/client";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Flex,
  Heading,
  Link,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useLoginMutation, useSharedQuery } from "@repo/graphql";
import { extractError, getCodeFromError } from "@repo/lib";
import { Form, Formik, FormikHelpers } from "formik";
import { InputControl, SubmitButton } from "formik-chakra-ui";
import NextLink from "next/link";
import Router, { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Yup from "yup";

export function isSafe(nextUrl: string | null) {
  return (nextUrl && nextUrl[0] === "/") || false;
}

export default function Home() {
  const [error, setError] = useState<Error | ApolloError | null>(null);
  const query = useSharedQuery();

  const router = useRouter();
  const { next: rawNext } = router.query;

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
          <Flex justifyContent="center" marginTop={16}>
            <Box maxW="md" w="100%">
              <Heading>Login</Heading>
              <LoginForm
                error={error}
                setError={setError}
                onSuccessRedirectTo={next}
              />
            </Box>
          </Flex>
        )
      }
    </SharedLayout>
  );
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
                onBlur: (e) =>
                  e.relatedTarget?.tagName === "a" && e.stopPropagation(),
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

            <Text className="lineText" width="100%" py={2} color="gray.600">
              Or continue with
            </Text>

            <SocialLoginOptions next={onSuccessRedirectTo} />
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
