import { TagsSelector } from "@/components/Tag/TagsSelector";
import {
  Button,
  FormControl,
  FormLabel,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  VStack,
} from "@chakra-ui/react";
import {
  CategoryFragment,
  ProjectFragment,
  useCreateProjectTagMutation,
  useCreateTagMutation,
  useDeleteProjectTagMutation,
  useUpdateProjectMutation,
} from "@repo/graphql";
import { globalState } from "@repo/lib";
import { OverlayToggleComponentProps } from "@repo/ui";
import { Form, Formik } from "formik";
import { InputControl, SelectControl, SubmitButton } from "formik-chakra-ui";
import { generateSlug } from "random-word-slugs";
import { useCallback, useEffect, useState } from "react";

export type EditProjectModalPropTypes = Omit<
  ModalProps,
  "isOpen" | "onClose" | "children"
> &
  Partial<OverlayToggleComponentProps> & {
    organizationId: string;
    categories: CategoryFragment[];
    project: ProjectFragment;
  };

type FormInputs = {
  name: string;
  categoryId: string | undefined;
};

const EditProjectModal = ({
  isOpen,
  onToggle,
  resetData,
  organizationId,
  categories,
  project,
  ...props
}: EditProjectModalPropTypes) => {
  const [updateProject] = useUpdateProjectMutation();
  const [createProjectTag] = useCreateProjectTagMutation();
  const [deleteProjectTag] = useDeleteProjectTagMutation();

  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    project.projectTags.nodes.map((x) => x.tag?.id),
  );
  // Update value when change (after update)
  useEffect(() => {
    const actualValue = project.projectTags.nodes.map((x) => x.tag?.id);
    setSelectedTagIds(actualValue);
  }, [project.projectTags.nodes]);

  const { publish } = globalState.modelDataAccess.usePublishAPIChanges({
    token: "page",
  });

  const { allTagByOrganization, refetch: refetchTags } =
    globalState.modelDataAccess.useTag();
  const [createTag] = useCreateTagMutation({
    onCompleted: () => {
      refetchTags?.();
    },
  });

  const handleSubmit = useCallback(
    async (data: FormInputs) => {
      await updateProject({
        variables: {
          id: project.id,
          slug: generateSlug(),
          name: data.name,
          categoryId: data.categoryId,
        },
      });
      const existingTagIds = project.projectTags.nodes.map((x) => x.tag?.id);
      const newTagIds = selectedTagIds;

      const missingTagIds = newTagIds.filter(
        (x) => !existingTagIds.includes(x),
      );
      const nonMissingTagIds = existingTagIds.filter(
        (x) => !newTagIds.includes(x),
      );

      const createPromises = missingTagIds.map((id) =>
        createProjectTag({
          variables: { projectId: project.id, tagId: id },
        }),
      );
      const deletePromises = nonMissingTagIds.map((id) =>
        deleteProjectTag({
          variables: {
            id: project.projectTags.nodes.find((x) => x.tag?.id === id)?.id,
          },
        }),
      );

      await Promise.all([...createPromises, ...deletePromises]);

      publish();

      onToggle?.();
      resetData?.();
    },
    [
      createProjectTag,
      deleteProjectTag,
      onToggle,
      project.id,
      project.projectTags.nodes,
      publish,
      resetData,
      selectedTagIds,
      updateProject,
    ],
  );

  return (
    <Modal
      size="xl"
      isOpen={isOpen ?? false}
      onClose={onToggle ?? (() => {})}
      {...props}
    >
      <ModalOverlay />
      <Formik
        initialValues={{
          name: project.name,
          categoryId: project.category?.id,
        }}
        onSubmit={handleSubmit}
      >
        {({ handleSubmit }) => (
          <Form onSubmit={handleSubmit as any}>
            <ModalContent>
              <ModalHeader>Edit Project</ModalHeader>
              <ModalCloseButton />
              <ModalBody>
                <VStack alignItems="flex-start">
                  <InputControl label="Name" name="name" />
                  <SelectControl name="categoryId" label="Category">
                    <option key="none" value={undefined}>
                      Uncategorized
                    </option>
                    {Object.values(categories).map(({ id, name }) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </SelectControl>

                  <FormControl>
                    <FormLabel>Tags</FormLabel>
                    <TagsSelector
                      value={selectedTagIds.map((tagId) => ({
                        value: allTagByOrganization?.find(
                          (tag) => tag.id === tagId,
                        ),
                        label:
                          allTagByOrganization?.find((tag) => tag.id === tagId)
                            ?.name ?? "",
                      }))}
                      onChange={(val) => {
                        const selectedIds: string[] =
                          val.map((x: any) => x.value.id) ?? [];

                        setSelectedTagIds(selectedIds);
                      }}
                      onCreateOption={(optionName: string) =>
                        createTag({
                          variables: {
                            name: optionName,
                            organizationId: organizationId,
                          },
                        })
                      }
                    />
                  </FormControl>
                </VStack>
              </ModalBody>
              <ModalFooter>
                <SubmitButton colorScheme="green">Save</SubmitButton>
                <Button variant="ghost" onClick={onToggle}>
                  Close
                </Button>
              </ModalFooter>
            </ModalContent>
          </Form>
        )}
      </Formik>
    </Modal>
  );
};

export default EditProjectModal;
