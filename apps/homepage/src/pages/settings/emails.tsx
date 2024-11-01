import { Redirect } from "@/components/Redirect";
import { SharedLayoutLoggedIn } from "@/components/SharedLayoutLoggedIn";
import { ApolloError } from "@apollo/client";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Divider,
  HStack,
  Heading,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
} from "@chakra-ui/react";
import {
  EmailsForm_UserEmailFragment,
  useAddEmailMutation,
  useDeleteEmailMutation,
  useMakeEmailPrimaryMutation,
  useResendEmailVerificationMutation,
  useSettingsEmailsPageQuery,
} from "@repo/graphql";
import { extractError } from "@repo/lib";
import { ErrorAlert, PopConfirm } from "@repo/ui";
import { Form, Formik } from "formik";
import { InputControl, SubmitButton } from "formik-chakra-ui";
import { NextPage } from "next";
import React, { useCallback, useState } from "react";
import { toast } from "react-toastify";
import * as Yup from "yup";

function Email({
  email,
  hasOtherEmails,
}: {
  email: EmailsForm_UserEmailFragment;
  hasOtherEmails: boolean;
}) {
  const canDelete = !email.isPrimary && hasOtherEmails;
  const [deleteEmail] = useDeleteEmailMutation();
  const [resendEmailVerification] = useResendEmailVerificationMutation();
  const [makeEmailPrimary] = useMakeEmailPrimaryMutation();

  const actions = [
    email.isPrimary && (
      <Text
        data-cy="settingsemails-indicator-primary"
        color="orange.500"
        fontWeight="bold"
      >
        Primary
      </Text>
    ),
    canDelete && (
      <PopConfirm
        title={`Are you sure you want to remove this email?`}
        onConfirm={() => {
          deleteEmail({
            variables: { emailId: email.id },
            onCompleted: () => {
              toast.success("Email deleted!");
            },
          });
        }}
        okText="Yes"
        cancelText="No"
        key="remove"
      >
        <Button size="sm" variant="link" data-cy="settingsemails-button-delete">
          Delete
        </Button>
      </PopConfirm>
    ),
    !email.isVerified && (
      <Button
        size="sm"
        variant="link"
        onClick={() =>
          resendEmailVerification({
            variables: { emailId: email.id },
            onCompleted: () => {
              toast.success("Verification email has been sent!");
            },
          })
        }
      >
        Resend verification
      </Button>
    ),
    email.isVerified && !email.isPrimary && (
      <Button
        size="sm"
        variant="link"
        onClick={() => makeEmailPrimary({ variables: { emailId: email.id } })}
        data-cy="settingsemails-button-makeprimary"
      >
        Make primary
      </Button>
    ),
  ].filter((x) => !!x);

  return (
    <Tr
      data-cy={`settingsemails-emailitem-${email.email.replace(
        /[^a-zA-Z0-9]/g,
        "-",
      )}`}
      key={email.id}
    >
      <Td>
        <Box>
          <Box>
            <Text>
              {email.email}{" "}
              <Text
                as="span"
                title={
                  email.isVerified
                    ? "Verified"
                    : "Pending verification (please check your inbox / spam folder)"
                }
              >
                {email.isVerified ? (
                  "✅"
                ) : (
                  <Text as="small" color="red">
                    (unverified)
                  </Text>
                )}
              </Text>
            </Text>
          </Box>
          <Text color="subtitle">
            Added {new Date(Date.parse(email.createdAt)).toLocaleString()}
          </Text>
        </Box>
      </Td>
      <Td>
        <HStack whiteSpace="nowrap" justifyContent="flex-end">
          {actions.map((action, i) => [
            action,
            i !== actions.length - 1 && (
              <Divider key={i} orientation="vertical" height="20px" />
            ),
          ])}
        </HStack>
      </Td>
    </Tr>
  );
}

const Settings_Emails: NextPage = () => {
  const [showAddEmailForm, setShowAddEmailForm] = useState(false);
  const [formError, setFormError] = useState<Error | ApolloError | null>(null);
  const query = useSettingsEmailsPageQuery();
  const { data, loading, error } = query;
  const user = data && data.currentUser;

  return (
    <SharedLayoutLoggedIn title="Email Settings" query={query} noHandleErrors>
      {error && !loading ? (
        <ErrorAlert error={error} />
      ) : !user && !loading ? (
        <Redirect
          href={`/login?next=${encodeURIComponent("/settings/emails")}`}
        />
      ) : !user ? (
        "Loading"
      ) : (
        <Box>
          <Heading>Email Addresses</Heading>
          {user.isVerified ? null : (
            <Box mb="0.5rem">
              <Alert status="warning">
                <AlertIcon />
                <Box flex="1">
                  <AlertTitle mr={2}>No verified emails</AlertTitle>
                  <AlertDescription display="block">
                    You do not have any verified email addresses, this will make
                    account recovery impossible and may limit your available
                    functionality within this application. Please complete email
                    verification.
                  </AlertDescription>
                </Box>
              </Alert>
            </Box>
          )}
          <Text>
            <b>Account notices will be sent your primary email address.</b>{" "}
            Additional email addresses may be added to help with account
            recovery (or to change your primary email), but they cannot be used
            until verified.
          </Text>

          <Box mb={5} />

          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Email address</Th>
                <Th width="130px"></Th>
              </Tr>
            </Thead>
            <Tbody>
              {user.userEmails.nodes.map((email, i) => (
                <Email
                  key={i}
                  email={email}
                  hasOtherEmails={user.userEmails.nodes.length > 1}
                />
              ))}
            </Tbody>
          </Table>

          <Box mb={5} />

          {!showAddEmailForm ? (
            <Button
              colorScheme="green"
              size="sm"
              onClick={() => setShowAddEmailForm(true)}
              data-cy="settingsemails-button-addemail"
            >
              Add another email
            </Button>
          ) : (
            <AddEmailForm
              onComplete={() => setShowAddEmailForm(false)}
              error={formError}
              setError={setFormError}
            />
          )}
        </Box>
      )}
    </SharedLayoutLoggedIn>
  );
};

export default Settings_Emails;

const validationSchema = Yup.object({
  email: Yup.string().required("Please enter an email address"),
});
type FormInputs = Yup.InferType<typeof validationSchema>;

interface AddEmailFormProps {
  onComplete: () => void;
  error: Error | ApolloError | null;
  setError: (error: Error | ApolloError | null) => void;
}

function AddEmailForm({ error, setError, onComplete }: AddEmailFormProps) {
  const [addEmail] = useAddEmailMutation();

  const onSubmit = useCallback(
    async (values: FormInputs) => {
      setError(null);
      try {
        await addEmail({ variables: { email: values.email } });
        onComplete();
        setError(null);
      } catch (e: any) {
        setError(e);
      }
    },
    [addEmail, onComplete, setError],
  );

  return (
    <Formik
      initialValues={{ email: "" }}
      onSubmit={onSubmit}
      validationSchema={validationSchema}
    >
      {({ handleSubmit }) => (
        <Form onSubmit={handleSubmit as any}>
          <VStack alignItems="flex-start">
            <InputControl
              name="email"
              label="New email"
              inputProps={{
                autoComplete: "email",
                // @ts-ignore
                "data-cy": "settingsemails-input-email",
              }}
            />

            {error ? (
              <Alert status="error">
                <AlertIcon />
                <Box flex="1">
                  <AlertTitle mr={2}>Error: Failed to add email</AlertTitle>
                  <AlertDescription display="block">
                    {extractError(error).message}
                  </AlertDescription>
                </Box>
              </Alert>
            ) : null}

            <SubmitButton
              colorScheme="green"
              data-cy="settingsemails-button-submit"
            >
              Add email
            </SubmitButton>
          </VStack>
        </Form>
      )}
    </Formik>
  );
}
