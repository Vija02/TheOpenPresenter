import {
  CategoryEdit,
  CategoryEditPropTypes,
  CategoryType,
} from "@/components/Category/CategoryEdit";
import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import {
  useOrganizationLoading,
  useOrganizationSlug,
} from "@/lib/permissionHooks/organization";
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
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  PopConfirm,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useDisclosure,
} from "@repo/ui";
import { FC, useCallback, useState } from "react";
import { FiPlus } from "react-icons/fi";
import { TbCategory } from "react-icons/tb";
import { VscEdit, VscTrash } from "react-icons/vsc";
import { toast } from "react-toastify";
import { CombinedError, UseQueryResponse } from "urql";

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
  query: UseQueryResponse<
    OrganizationSettingsCategoriesPageQuery,
    Exact<OrganizationSettingsCategoriesPageQueryVariables>
  >;
}

const OrganizationSettingsCategoriesPageInner: FC<
  OrganizationSettingsCategoriesPageInnerProps
> = ({ query: [{ data }] }) => {
  const [error, setError] = useState<CombinedError | null>(null);
  const [editError, setEditError] = useState<CombinedError | null>(null);

  const {
    open: newIsOpen,
    onOpen: newOnOpen,
    onClose: newOnClose,
  } = useDisclosure();
  const [editingCategory, setEditingCategory] = useState<
    (CategoryEditPropTypes["initialCategory"] & { id: string }) | null
  >(null);

  const { publish } = globalState.modelDataAccess.usePublishAPIChanges({
    token: "page",
  });

  const [, createCategory] = useCreateCategoryMutation();
  const [, editCategory] = useUpdateCategoryMutation();
  const [, deleteCategory] = useDeleteCategoryMutation();

  const newOnCreate = useCallback(
    async (values: CategoryType) => {
      try {
        setError(null);
        await createCategory({
          name: values.name,
          organizationId: data?.organizationBySlug?.id,
        });
        publish();
        toast.success("Category created");
        newOnClose();
      } catch (e: any) {
        setError(e);
      }
    },
    [createCategory, data?.organizationBySlug?.id, publish, newOnClose],
  );

  const onEdit = useCallback(
    async (values: CategoryType) => {
      try {
        setEditError(null);
        await editCategory({
          id: editingCategory?.id,
          name: values.name,
        });
        publish();
        toast.success("Category updated");
        setEditingCategory(null);
      } catch (e: any) {
        setEditError(e);
      }
    },
    [editCategory, editingCategory?.id, publish],
  );

  const onDeleteCategory = useCallback(
    async (id: string) => {
      try {
        await deleteCategory({
          id,
        });
        publish();
        toast.success("Category deleted");
      } catch (e: any) {
        toast.error("Failed to delete category");
      }
    },
    [deleteCategory, publish],
  );

  const categories = data?.organizationBySlug?.categories.nodes;

  return (
    <div className="stack-col items-start">
      <h1 className="text-2xl font-bold">Categories</h1>

      {categories?.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center min-h-[200px] py-10 bg-surface-secondary shadow-md rounded w-full">
          <TbCategory fontSize={40} />
          <h2 className="mt-4 mb-1 text-lg font-bold">
            Welcome to the Categories settings!
          </h2>
          <p className="text-secondary">
            You can create categories in this page to categorize projects.
          </p>
          <Button className="mt-4" variant="success" onClick={newOnOpen}>
            Create a Category
          </Button>

          <div className="w-full px-5">
            {newIsOpen && (
              <div className="bg-surface-primary w-full px-5 py-5 mt-5 rounded">
                <CategoryEdit
                  initialCategory={{
                    name: "",
                  }}
                  error={error}
                  onCreate={newOnCreate}
                  onCancel={newOnClose}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {categories && categories?.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead style={{ width: "130px" }}></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell>{category.name}</TableCell>
                  <TableCell style={{ width: "130px" }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingCategory(category);
                      }}
                    >
                      <VscEdit className="text-secondary" />
                    </Button>
                    <PopConfirm
                      title={`Are you sure you want to delete this category?`}
                      onConfirm={() => {
                        onDeleteCategory(category.id);
                      }}
                      description="This action is not reversible. Projects will NOT be deleted but the corresponding category will."
                      okText="Yes"
                      cancelText="No"
                      key="remove"
                    >
                      <Button variant="ghost" size="sm">
                        <VscTrash className="text-secondary" />
                      </Button>
                    </PopConfirm>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex justify-center w-full">
            <Button
              size="sm"
              className="mt-4 stack-row items-center"
              variant="outline"
              onClick={newOnOpen}
            >
              <FiPlus />
              Add Category
            </Button>
          </div>

          <div className="w-full px-5">
            {newIsOpen && (
              <div className="shadow rounded w-full px-5 py-5 mt-5">
                <CategoryEdit
                  initialCategory={{
                    name: "",
                  }}
                  error={error}
                  onCreate={newOnCreate}
                  onCancel={newOnClose}
                />
              </div>
            )}
          </div>
        </>
      )}

      <Dialog
        open={!!editingCategory}
        onOpenChange={(open) => !open && setEditingCategory(null)}
      >
        <DialogContent size="2xl">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>
          <DialogBody>
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
            <div className="mb-4" />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrganizationSettingsCategoriesPage;
