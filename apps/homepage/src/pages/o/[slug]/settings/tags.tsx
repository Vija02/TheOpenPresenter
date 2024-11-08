import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import { Tag, TagEdit, TagEditPropTypes, TagType } from "@/components/Tag";
import {
  useOrganizationLoading,
  useOrganizationSlug,
} from "@/lib/permissionHooks/organization";
import { ApolloError, QueryResult } from "@apollo/client";
import {
  Box,
  Button,
  Collapse,
  Flex,
  Heading,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useDisclosure,
} from "@chakra-ui/react";
import {
  Exact,
  OrganizationSettingsTagsPageQuery,
  OrganizationSettingsTagsPageQueryVariables,
  useCreateTagMutation,
  useDeleteTagMutation,
  useOrganizationSettingsTagsPageQuery,
  useUpdateTagMutation,
} from "@repo/graphql";
import { globalState } from "@repo/lib";
import { PopConfirm } from "@repo/ui";
import { NextPage } from "next";
import { FC, useCallback, useState } from "react";
import { FiPlus, FiTag } from "react-icons/fi";
import { VscEdit, VscTrash } from "react-icons/vsc";
import { toast } from "react-toastify";

const OrganizationSettingsTagsPage: NextPage = () => {
  const slug = useOrganizationSlug();
  const query = useOrganizationSettingsTagsPageQuery({
    variables: { slug },
  });

  const organizationLoadingElement = useOrganizationLoading(query);

  return (
    <SharedOrgLayout title="Tags" sharedOrgQuery={query}>
      {organizationLoadingElement || (
        <OrganizationSettingsTagsPageInner query={query} />
      )}
    </SharedOrgLayout>
  );
};

interface OrganizationSettingsTagsPageInnerProps {
  query: QueryResult<
    OrganizationSettingsTagsPageQuery,
    Exact<OrganizationSettingsTagsPageQueryVariables>
  >;
}

const OrganizationSettingsTagsPageInner: FC<
  OrganizationSettingsTagsPageInnerProps
> = ({ query }) => {
  const [error, setError] = useState<ApolloError | null>(null);
  const [editError, setEditError] = useState<ApolloError | null>(null);

  const {
    isOpen: newIsOpen,
    onOpen: newOnOpen,
    onClose: newOnClose,
  } = useDisclosure();
  const [editingTag, setEditingTag] = useState<
    (TagEditPropTypes["initialTag"] & { id: string }) | null
  >(null);

  const { publish } = globalState.modelDataAccess.usePublishAPIChanges({
    token: "page",
  });

  const [createTag] = useCreateTagMutation({
    onCompleted: publish,
  });
  const [editTag] = useUpdateTagMutation({
    onCompleted: publish,
  });
  const [deleteTag] = useDeleteTagMutation({
    onCompleted: publish,
  });

  const newOnCreate = useCallback(
    async (values: TagType) => {
      try {
        setError(null);
        await createTag({
          variables: {
            name: values.name,
            description: values.description,
            backgroundColor: values.backgroundColor,
            foregroundColor: values.foregroundColor,
            variant: values.variant,
            organizationId: query.data?.organizationBySlug?.id,
          },
        });
        toast.success("Tag created");
        newOnClose();
      } catch (e: any) {
        setError(e);
      }
    },
    [query, createTag, newOnClose],
  );

  const onEdit = useCallback(
    async (values: TagType) => {
      try {
        setEditError(null);
        await editTag({
          variables: {
            id: editingTag?.id,
            name: values.name,
            description: values.description ?? "",
            backgroundColor: values.backgroundColor ?? "",
            foregroundColor: values.foregroundColor ?? "",
            variant: values.variant ?? "",
          },
        });
        toast.success("Tag updated");
        setEditingTag(null);
      } catch (e: any) {
        setEditError(e);
      }
    },
    [editTag, editingTag?.id],
  );

  const onDeleteTag = useCallback(
    async (id: string) => {
      try {
        await deleteTag({
          variables: {
            id,
          },
        });
        toast.success("Tag deleted");
      } catch (e: any) {
        toast.error("Failed to delete tag");
      }
    },
    [deleteTag],
  );

  const tags = query.data?.organizationBySlug?.tags.nodes;

  return (
    <>
      <Heading>Tags</Heading>

      {tags?.length === 0 && (
        <Box
          backgroundColor="gray.100"
          shadow="md"
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          textAlign="center"
          minHeight="200px"
          paddingY={10}
        >
          <FiTag fontSize={40} />
          <Heading mt={4} mb={1} fontSize="lg">
            Welcome to the Tags settings!
          </Heading>
          <Text>You can create tags in this page to categorize projects.</Text>
          <Button mt={4} colorScheme="green" onClick={newOnOpen}>
            Create a Tag
          </Button>

          <Box width="100%" px={5}>
            <Collapse in={newIsOpen}>
              <Box backgroundColor="white" width="100%" px={5} py={5} mt={5}>
                <TagEdit
                  initialTag={{
                    name: "",
                    description: "",
                    foregroundColor: "",
                    backgroundColor: "",
                    variant: "solid",
                  }}
                  error={error}
                  onCreate={newOnCreate}
                  onCancel={newOnClose}
                />
              </Box>
            </Collapse>
          </Box>
        </Box>
      )}

      {tags && tags?.length > 0 && (
        <>
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Tag Name</Th>
                <Th>Description</Th>
                <Th width="130px"></Th>
              </Tr>
            </Thead>
            <Tbody>
              {tags.map((tag) => (
                <Tr key={tag.id}>
                  <Td>
                    <Tag tag={tag} />
                  </Td>
                  <Td>{tag.description}</Td>
                  <Td width="130px">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingTag(tag);
                      }}
                    >
                      <VscEdit color="gray" />
                    </Button>
                    <PopConfirm
                      title={`Are you sure you want to delete this tag? This action is not reversible. Projects will NOT be deleted but the corresponding tag will`}
                      onConfirm={() => {
                        onDeleteTag(tag.id);
                      }}
                      okText="Yes"
                      cancelText="No"
                      key="remove"
                    >
                      <Button variant="ghost" size="sm">
                        <VscTrash color="gray" />
                      </Button>
                    </PopConfirm>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>

          <Flex justifyContent="center">
            <Button
              leftIcon={<FiPlus />}
              size="sm"
              mt={4}
              colorScheme="green"
              variant="outline"
              onClick={newOnOpen}
            >
              Add Tag
            </Button>
          </Flex>

          <Box width="100%" px={5}>
            <Collapse in={newIsOpen}>
              <Box shadow="base" width="100%" px={5} py={5} mt={5}>
                <TagEdit
                  initialTag={{
                    name: "",
                    description: "",
                    foregroundColor: "",
                    backgroundColor: "",
                    variant: "solid",
                  }}
                  error={error}
                  onCreate={newOnCreate}
                  onCancel={newOnClose}
                />
              </Box>
            </Collapse>
          </Box>
        </>
      )}

      <Modal
        size="2xl"
        isOpen={!!editingTag}
        onClose={() => setEditingTag(null)}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Tag</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {!!editingTag && (
              <TagEdit
                key={JSON.stringify(editingTag)}
                initialTag={editingTag}
                error={editError}
                onCreate={onEdit}
                onCancel={() => setEditingTag(null)}
                submitText="Edit"
              />
            )}
            <Box mb={4} />
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
};
export default OrganizationSettingsTagsPage;
