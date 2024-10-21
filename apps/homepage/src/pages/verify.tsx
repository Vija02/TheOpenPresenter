import { SharedLayout } from "@/components/SharedLayout";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Flex,
  VStack,
} from "@chakra-ui/react";
import { useSharedQuery, useVerifyEmailMutation } from "@repo/graphql";
import { extractError } from "@repo/lib";
import { Form, Formik } from "formik";
import { InputControl, SubmitButton } from "formik-chakra-ui";
import { NextPage } from "next";
import { useRouter } from "next/router";
import React, { useCallback, useEffect } from "react";
import * as Yup from "yup";

const validationSchema = Yup.object({
  code: Yup.string().required("Please enter your verification code"),
});
type FormInputs = Yup.InferType<typeof validationSchema>;

const VerifyPage: NextPage = () => {
  const router = useRouter();
  const { id: rawId, token: rawToken } = router.query;

  const initialShouldSubmit = !!rawId && !!rawToken;

  const [error, setError] = React.useState<Error | null>(null);
  const [verifyEmail, { data, loading }] = useVerifyEmailMutation();

  const success = !!data?.verifyEmail?.success;

  useEffect(() => {
    if (initialShouldSubmit) {
      setError(null);
      verifyEmail({
        variables: {
          id: rawId.toString(),
          token: rawToken.toString()!,
        },
      }).catch((e: Error) => {
        setError(e);
      });
    }
  }, [initialShouldSubmit, rawId, rawToken, verifyEmail]);

  const onSubmit = useCallback(
    async (values: FormInputs) => {
      setError(null);
      try {
        await verifyEmail({
          variables: {
            id: rawId,
            token: values.code,
          },
        });
      } catch (e: any) {
        setError(e);
      }
    },
    [rawId, verifyEmail],
  );

  const query = useSharedQuery();
  return (
    <SharedLayout title="Verify Email Address" query={query}>
      <Flex justifyContent="center" marginTop={10}>
        <Box maxW="lg" w="100%">
          {((!initialShouldSubmit && !success) || !!error) && (
            <Formik
              initialValues={{ code: "" }}
              onSubmit={onSubmit}
              validationSchema={validationSchema}
            >
              {({ handleSubmit }) => (
                <Form onSubmit={handleSubmit as any}>
                  <VStack alignItems="flex-start">
                    <InputControl
                      name="code"
                      label="Please enter your email verification code"
                      inputProps={{
                        // @ts-ignore
                        "data-cy": "verifypage-input-code",
                      }}
                    />

                    {error ? (
                      <Alert status="error">
                        <AlertIcon />
                        <Box flex="1">
                          <AlertTitle mr={2}>
                            Error: Failed to verify email
                          </AlertTitle>
                          <AlertDescription display="block">
                            {extractError(error).message}
                          </AlertDescription>
                        </Box>
                      </Alert>
                    ) : null}

                    <SubmitButton
                      colorScheme="green"
                      data-cy="verifypage-button-submit"
                    >
                      Submit
                    </SubmitButton>
                  </VStack>
                </Form>
              )}
            </Formik>
          )}
          {loading && "Verifying..."}
          {success && (
            <Alert status="success">
              <AlertIcon />
              <Box flex="1">
                <AlertTitle mr={2}>Email Verified</AlertTitle>
                <AlertDescription display="block">
                  Thank you for verifying your email address. You may now close
                  this window.
                </AlertDescription>
              </Box>
            </Alert>
          )}
        </Box>
      </Flex>
    </SharedLayout>
  );
};

export default VerifyPage;
