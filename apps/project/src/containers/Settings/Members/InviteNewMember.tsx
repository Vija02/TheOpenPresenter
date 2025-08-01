import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Heading,
  VStack,
} from "@chakra-ui/react";
import { useInviteToOrganizationMutation } from "@repo/graphql";
import { extractError } from "@repo/lib";
import { Form, Formik, FormikHelpers } from "formik";
import { InputControl, SubmitButton } from "formik-chakra-ui";
import React, { useCallback, useState } from "react";
import { toast } from "react-toastify";

type PropTypes = { organization: { id: string } };

export default function InviteNewMember({ organization }: PropTypes) {
  const [inviteToOrganization] = useInviteToOrganizationMutation();
  const [inviteInProgress, setInviteInProgress] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const handleInviteSubmit = useCallback(
    async (values: any, { resetForm }: FormikHelpers<any>) => {
      if (inviteInProgress) {
        return;
      }
      setError(null);

      const { inviteText } = values;
      setInviteInProgress(true);
      const isEmail = inviteText.includes("@");
      try {
        await inviteToOrganization({
          variables: {
            organizationId: organization.id,
            email: isEmail ? inviteText : null,
            username: isEmail ? null : inviteText,
          },
        });
        toast.success(`'${inviteText}' invited.`);
        resetForm();
      } catch (e: any) {
        setError(e);
      } finally {
        setInviteInProgress(false);
      }
    },
    [inviteInProgress, inviteToOrganization, organization.id],
  );

  return (
    <Box boxShadow="base" p={3}>
      <Heading size="md">Invite new member</Heading>
      <Formik initialValues={{ inviteText: "" }} onSubmit={handleInviteSubmit}>
        {({ handleSubmit }) => (
          <Form onSubmit={handleSubmit as any}>
            <VStack alignItems="flex-start">
              <InputControl
                name="inviteText"
                label="Username or Email"
                inputProps={{ placeholder: "Enter username or email" }}
              />

              {error ? (
                <Alert status="error">
                  <AlertIcon />
                  <Box flex="1">
                    <AlertTitle mr={2}>
                      Could not invite to organization
                    </AlertTitle>
                    <AlertDescription display="block">
                      {extractError(error).message}
                    </AlertDescription>
                  </Box>
                </Alert>
              ) : null}

              <SubmitButton colorScheme="green">Invite</SubmitButton>
            </VStack>
          </Form>
        )}
      </Formik>
    </Box>
  );
}
