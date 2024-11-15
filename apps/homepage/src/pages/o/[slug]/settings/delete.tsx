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
  Text,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import {
  BaseOrganizationSettingsPageQuery,
  BaseOrganizationSettingsPageQueryVariables,
  Exact,
  useBaseOrganizationSettingsPageQuery,
  useDeleteOrganizationMutation,
} from "@repo/graphql";
import { ErrorAlert } from "@repo/ui";
import { NextPage } from "next";
import { useRouter } from "next/router";
import { FC, useCallback, useState } from "react";
import { toast } from "react-toastify";

const OrganizationSettingsDeletePage: NextPage = () => {
  const slug = useOrganizationSlug();
  const query = useBaseOrganizationSettingsPageQuery({
    variables: { slug },
  });

  const organizationLoadingElement = useOrganizationLoading(query);

  return (
    <SharedOrgLayout title="Delete Organization" sharedOrgQuery={query}>
      {organizationLoadingElement || (
        <OrganizationSettingsDeletePageInner query={query} />
      )}
    </SharedOrgLayout>
  );
};

interface OrganizationSettingsDeletePageInnerProps {
  query: QueryResult<
    BaseOrganizationSettingsPageQuery,
    Exact<BaseOrganizationSettingsPageQueryVariables>
  >;
}

const OrganizationSettingsDeletePageInner: FC<
  OrganizationSettingsDeletePageInnerProps
> = ({ query }) => {
  const organization = query.data?.organizationBySlug!;
  const router = useRouter();
  const [deleteOrganization] = useDeleteOrganizationMutation();
  const [error, setError] = useState<ApolloError | null>(null);

  const { isOpen, onOpen, onClose } = useDisclosure();

  const handleDelete = useCallback(async () => {
    setError(null);
    try {
      await deleteOrganization({
        variables: {
          organizationId: organization.id,
        },
        refetchQueries: ["Shared"],
      });
      toast.success(`Organization '${organization.name}' successfully deleted`);
      router.push("/");
    } catch (e: any) {
      setError(e);
      return;
    }
  }, [deleteOrganization, organization.id, organization.name, router]);

  return (
    <>
      <Heading>Delete Organization?</Heading>
      {organization.currentUserIsOwner ? (
        <Alert status="error">
          <AlertIcon />
          <Box flex="1">
            <AlertTitle mr={2}>
              Are you sure you want to delete '{organization.name}'?
            </AlertTitle>
            <AlertDescription display="block">
              <VStack alignItems="flex-start">
                <Text>This action cannot be undone, be very careful.</Text>
                <Button colorScheme="red" onClick={onOpen}>
                  Delete this organization
                </Button>
              </VStack>
            </AlertDescription>
          </Box>
        </Alert>
      ) : (
        <Alert status="error">
          <Box flex="1">
            <AlertTitle mr={2}>You are not permitted to do this</AlertTitle>
            <AlertDescription display="block">
              Only the owner may delete the organization. If you cannot reach
              the owner, please get in touch with support.
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
            This action cannot be undone, be very careful. Click delete to
            continue
          </ModalBody>

          <ModalFooter>
            <Button colorScheme="red" mr={3} onClick={handleDelete}>
              Delete
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

export default withDeviceType(OrganizationSettingsDeletePage);
