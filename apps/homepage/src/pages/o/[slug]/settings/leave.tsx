import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import { getServerSidePropsDeviceType, withDeviceType } from "@/lib/DeviceType";
import {
  useOrganizationLoading,
  useOrganizationSlug,
} from "@/lib/permissionHooks/organization";
import { ApolloError, QueryResult } from "@apollo/client";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Heading,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import {
  BaseOrganizationSettingsPageQuery,
  BaseOrganizationSettingsPageQueryVariables,
  Exact,
  useBaseOrganizationSettingsPageQuery,
  useRemoveFromOrganizationMutation,
} from "@repo/graphql";
import { ErrorAlert } from "@repo/ui";
import { NextPage } from "next";
import { useRouter } from "next/router";
import { FC, useCallback, useState } from "react";
import { toast } from "react-toastify";

const OrganizationSettingsLeavePage: NextPage = () => {
  const slug = useOrganizationSlug();
  const query = useBaseOrganizationSettingsPageQuery({
    variables: { slug },
  });

  const organizationLoadingElement = useOrganizationLoading(query);

  return (
    <SharedOrgLayout title="Leave Organization" sharedOrgQuery={query}>
      {organizationLoadingElement || (
        <OrganizationSettingsLeavePageInner query={query} />
      )}
    </SharedOrgLayout>
  );
};

interface OrganizationSettingsLeavePageInnerProps {
  query: QueryResult<
    BaseOrganizationSettingsPageQuery,
    Exact<BaseOrganizationSettingsPageQueryVariables>
  >;
}

const OrganizationSettingsLeavePageInner: FC<
  OrganizationSettingsLeavePageInnerProps
> = ({ query }) => {
  const organization = query.data?.organizationBySlug!;
  const router = useRouter();
  const [error, setError] = useState<ApolloError | null>(null);

  const { isOpen, onOpen, onClose } = useDisclosure();

  const [removeMember] = useRemoveFromOrganizationMutation();
  const handleRemove = useCallback(async () => {
    setError(null);
    try {
      await removeMember({
        variables: {
          organizationId: organization.id,
          userId: query.data?.currentUser?.id,
        },
      });
      toast.success(`Successfully left '${organization.name}'`);
      router.push("/");
    } catch (e: any) {
      setError(e);
      toast.error("Error occurred when leaving: " + e.message);
    }
  }, [
    organization.id,
    organization.name,
    query.data?.currentUser?.id,
    removeMember,
    router,
  ]);

  return (
    <>
      <Heading>Leave Organization?</Heading>

      {organization.currentUserIsOwner ? (
        <Alert status="error">
          <Box flex="1">
            <AlertTitle mr={2}>You are not permitted to do this</AlertTitle>
            <AlertDescription display="block">
              You cannot leave the organization as the owner of this
              organization.
            </AlertDescription>
          </Box>
        </Alert>
      ) : (
        <Alert status="error">
          <AlertIcon />
          <Box flex="1">
            <AlertTitle mr={2}>
              Are you sure you want to leave '{organization.name}'?
            </AlertTitle>
            <Box mb={2} />
            <AlertDescription display="block">
              <VStack alignItems="flex-start">
                <Button colorScheme="red" onClick={onOpen}>
                  Leave this organization
                </Button>
              </VStack>
            </AlertDescription>
          </Box>
        </Alert>
      )}

      {error ? <ErrorAlert error={error} /> : null}

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Confirm</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            This action cannot be undone. Click Leave to continue
          </ModalBody>

          <ModalFooter>
            <Button colorScheme="red" mr={3} onClick={handleRemove}>
              Leave
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export const getServerSideProps = getServerSidePropsDeviceType;

export default withDeviceType(OrganizationSettingsLeavePage);
