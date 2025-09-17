import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import { Tag, TagEdit, TagEditPropTypes, TagType } from "@/components/Tag";
import {
  useOrganizationLoading,
  useOrganizationSlug,
} from "@/lib/permissionHooks/organization";
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
import { FiPlus, FiTag } from "react-icons/fi";
import { VscEdit, VscTrash } from "react-icons/vsc";
import { toast } from "react-toastify";
import { CombinedError, UseQueryResponse } from "urql";

const OrganizationSettingsTagsPage = () => {
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
  query: UseQueryResponse<
    OrganizationSettingsTagsPageQuery,
    Exact<OrganizationSettingsTagsPageQueryVariables>
  >;
}

const OrganizationSettingsTagsPageInner: FC<
  OrganizationSettingsTagsPageInnerProps
> = ({ query: [{ data }] }) => {
  const [error, setError] = useState<CombinedError | null>(null);
  const [editError, setEditError] = useState<CombinedError | null>(null);

  const {
    open: newIsOpen,
    onOpen: newOnOpen,
    onClose: newOnClose,
  } = useDisclosure();
  const [editingTag, setEditingTag] = useState<
    (TagEditPropTypes["initialTag"] & { id: string }) | null
  >(null);

  const { publish } = globalState.modelDataAccess.usePublishAPIChanges({
    token: "page",
  });

  const [, createTag] = useCreateTagMutation();
  const [, editTag] = useUpdateTagMutation();
  const [, deleteTag] = useDeleteTagMutation();

  const newOnCreate = useCallback(
    async (values: TagType) => {
      try {
        setError(null);
        await createTag({
          name: values.name,
          description: values.description,
          backgroundColor: values.backgroundColor,
          foregroundColor: values.foregroundColor,
          variant: values.variant,
          organizationId: data?.organizationBySlug?.id,
        });
        publish();
        toast.success("Tag created");
        newOnClose();
      } catch (e: any) {
        setError(e);
      }
    },
    [createTag, data?.organizationBySlug?.id, newOnClose, publish],
  );

  const onEdit = useCallback(
    async (values: TagType) => {
      try {
        setEditError(null);
        await editTag({
          id: editingTag?.id,
          name: values.name,
          description: values.description ?? "",
          backgroundColor: values.backgroundColor ?? "",
          foregroundColor: values.foregroundColor ?? "",
          variant: values.variant ?? "",
        });
        publish();
        toast.success("Tag updated");
        setEditingTag(null);
      } catch (e: any) {
        setEditError(e);
      }
    },
    [editTag, editingTag?.id, publish],
  );

  const onDeleteTag = useCallback(
    async (id: string) => {
      try {
        await deleteTag({
          id,
        });
        publish();
        toast.success("Tag deleted");
      } catch (e: any) {
        toast.error("Failed to delete tag");
      }
    },
    [deleteTag, publish],
  );

  const tags = data?.organizationBySlug?.tags.nodes;

  return (
    <div className="stack-col items-start">
      <h1 className="text-2xl font-bold">Tags</h1>

      {tags?.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center min-h-[200px] py-10 bg-surface-secondary shadow-md rounded w-full">
          <FiTag fontSize={40} />
          <h2 className="mt-4 mb-1 text-lg font-bold">
            Welcome to the Tags settings!
          </h2>
          <p className="text-secondary">
            You can create tags in this page to categorize projects.
          </p>
          <Button className="mt-4" variant="success" onClick={newOnOpen}>
            Create a Tag
          </Button>

          <div className="w-full px-5">
            {newIsOpen && (
              <div className="bg-surface-primary w-full px-5 py-5 mt-5 rounded">
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
              </div>
            )}
          </div>
        </div>
      )}

      {tags && tags?.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tag Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead style={{ width: "130px" }}></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.map((tag) => (
                <TableRow key={tag.id}>
                  <TableCell>
                    <Tag tag={tag} />
                  </TableCell>
                  <TableCell>{tag.description}</TableCell>
                  <TableCell style={{ width: "130px" }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingTag(tag);
                      }}
                    >
                      <VscEdit className="text-secondary" />
                    </Button>
                    <PopConfirm
                      title={`Are you sure you want to delete this tag?`}
                      onConfirm={() => {
                        onDeleteTag(tag.id);
                      }}
                      description="This action is not reversible. Projects will NOT be deleted but the corresponding tag will."
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
              Add Tag
            </Button>
          </div>

          <div className="w-full px-5">
            {newIsOpen && (
              <div className="shadow rounded w-full px-5 py-5 mt-5">
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
              </div>
            )}
          </div>
        </>
      )}

      <Dialog
        open={!!editingTag}
        onOpenChange={(open) => !open && setEditingTag(null)}
      >
        <DialogContent size="2xl">
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
          </DialogHeader>
          <DialogBody>
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
            <div className="mb-4" />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrganizationSettingsTagsPage;
