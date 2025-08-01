import {
  CategoryEdit,
  CategoryEditPropTypes,
  CategoryType,
} from "@/components/Category/CategoryEdit";
import { PopConfirm } from "@/components/PopConfirm";
import { SharedOrgLayout } from "@/components/SharedOrgLayout";
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
  OrganizationSettingsCategoriesPageQuery,
  OrganizationSettingsCategoriesPageQueryVariables,
  useCreateCategoryMutation,
  useDeleteCategoryMutation,
  useOrganizationSettingsCategoriesPageQuery,
  useUpdateCategoryMutation,
} from "@repo/graphql";
import { globalState } from "@repo/lib";
import { FC, useCallback, useState } from "react";
import { FiPlus } from "react-icons/fi";
import { TbCategory } from "react-icons/tb";
import { VscEdit, VscTrash } from "react-icons/vsc";
import { toast } from "react-toastify";

const OrganizationSettingsCategoriesPage = () => {
  const slug = useOrganizationSlug();
  const query = useOrganizationSettingsCategoriesPageQuery({
    variables: { slug },
  });

  const organizationLoadingElement = useOrganizationLoading(query);

  return (
    <SharedOrgLayout title="Categories" sharedOrgQuery={query}>
      {organizationLoadingElement || (
        <OrganizationSettingsCategoriesPageInner query={query} />
      )}
    </SharedOrgLayout>
  );
};

interface OrganizationSettingsCategoriesPageInnerProps {
  query: QueryResult<
    OrganizationSettingsCategoriesPageQuery,
    Exact<OrganizationSettingsCategoriesPageQueryVariables>
  >;
}

const OrganizationSettingsCategoriesPageInner: FC<
  OrganizationSettingsCategoriesPageInnerProps
> = ({ query }) => {
  const [error, setError] = useState<ApolloError | null>(null);
  const [editError, setEditError] = useState<ApolloError | null>(null);

  const {
    isOpen: newIsOpen,
    onOpen: newOnOpen,
    onClose: newOnClose,
  } = useDisclosure();
  const [editingCategory, setEditingCategory] = useState<
    (CategoryEditPropTypes["initialCategory"] & { id: string }) | null
  >(null);

  const { publish } = globalState.modelDataAccess.usePublishAPIChanges({
    token: "page",
  });

  const [createCategory] = useCreateCategoryMutation({
    onCompleted: publish,
  });
  const [editCategory] = useUpdateCategoryMutation({
    onCompleted: publish,
  });
  const [deleteCategory] = useDeleteCategoryMutation({
    onCompleted: publish,
  });

  const newOnCreate = useCallback(
    async (values: CategoryType) => {
      try {
        setError(null);
        await createCategory({
          variables: {
            name: values.name,
            organizationId: query.data?.organizationBySlug?.id,
          },
        });
        toast.success("Category created");
        newOnClose();
      } catch (e: any) {
        setError(e);
      }
    },
    [query, createCategory, newOnClose],
  );

  const onEdit = useCallback(
    async (values: CategoryType) => {
      try {
        setEditError(null);
        await editCategory({
          variables: {
            id: editingCategory?.id,
            name: values.name,
          },
        });
        toast.success("Category updated");
        setEditingCategory(null);
      } catch (e: any) {
        setEditError(e);
      }
    },
    [editCategory, editingCategory?.id],
  );

  const onDeleteCategory = useCallback(
    async (id: string) => {
      try {
        await deleteCategory({
          variables: {
            id,
          },
        });
        toast.success("Category deleted");
      } catch (e: any) {
        toast.error("Failed to delete category");
      }
    },
    [deleteCategory],
  );

  const categories = query.data?.organizationBySlug?.categories.nodes;

  return (
    <>
      <Heading>Categories</Heading>

      {categories?.length === 0 && (
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
          <TbCategory fontSize={40} />
          <Heading mt={4} mb={1} fontSize="lg">
            Welcome to the Categories settings!
          </Heading>
          <Text>
            You can create categories in this page to categorize projects.
          </Text>
          <Button mt={4} colorScheme="green" onClick={newOnOpen}>
            Create a Category
          </Button>

          <Box width="100%" px={5}>
            <Collapse in={newIsOpen}>
              <Box backgroundColor="white" width="100%" px={5} py={5} mt={5}>
                <CategoryEdit
                  initialCategory={{
                    name: "",
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

      {categories && categories?.length > 0 && (
        <>
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Category</Th>
                <Th width="130px"></Th>
              </Tr>
            </Thead>
            <Tbody>
              {categories.map((category) => (
                <Tr key={category.id}>
                  <Td>{category.name}</Td>
                  <Td width="130px">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        // setEditingCategory(category);
                      }}
                    >
                      <VscEdit color="gray" />
                    </Button>
                    <PopConfirm
                      title={`Are you sure you want to delete this category? This action is not reversible. Projects will NOT be deleted but the corresponding category will`}
                      onConfirm={() => {
                        onDeleteCategory(category.id);
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
              Add Category
            </Button>
          </Flex>

          <Box width="100%" px={5}>
            <Collapse in={newIsOpen}>
              <Box shadow="base" width="100%" px={5} py={5} mt={5}>
                <CategoryEdit
                  initialCategory={{
                    name: "",
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
        isOpen={!!editingCategory}
        onClose={() => setEditingCategory(null)}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Category</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {!!editingCategory && (
              <CategoryEdit
                key={JSON.stringify(editingCategory)}
                initialCategory={editingCategory}
                error={editError}
                onCreate={onEdit}
                onCancel={() => setEditingCategory(null)}
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

export default OrganizationSettingsCategoriesPage;
