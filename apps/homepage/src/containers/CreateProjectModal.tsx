import { TagsSelector } from "@/components/Tag/TagsSelector";
import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
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
  useCreateProjectMutation,
  useCreateTagMutation,
} from "@repo/graphql";
import { globalState } from "@repo/lib";
import { OverlayToggleComponentProps } from "@repo/ui";
import { format } from "date-fns";
import { Form, Formik } from "formik";
import { InputControl, SelectControl, SubmitButton } from "formik-chakra-ui";
import { generateSlug } from "random-word-slugs";
import { useCallback, useMemo, useState } from "react";

export type CreateProjectModalPropTypes = Omit<
  ModalProps,
  "isOpen" | "onClose" | "children"
> &
  Partial<OverlayToggleComponentProps> & {
    organizationId: string;
    categories: CategoryFragment[];
  };

type FormInputs = {
  name: string;
  categoryId: string | undefined;
  tagIds: string[];
};

const CreateProjectModal = ({
  isOpen,
  onToggle,
  resetData,
  organizationId,
  categories,
  ...props
}: CreateProjectModalPropTypes) => {
  const [createProject] = useCreateProjectMutation();
  const slug = useOrganizationSlug();

  const namePlaceholder = useMemo(
    () => `Untitled (${format(new Date(), "do MMM yyyy")})`,
    [],
  );

  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const { allTagByOrganization, refetch: refetchTags } =
    globalState.modelDataAccess.useTag();
  const [createTag] = useCreateTagMutation({
    onCompleted: () => {
      refetchTags?.();
    },
  });

  const handleSubmit = useCallback(
    (data: FormInputs) => {
      createProject({
        variables: {
          organizationId,
          slug: generateSlug(),
          name: data.name === "" ? namePlaceholder : data.name,
          categoryId: data.categoryId,
          tags: selectedTagIds,
        },
      }).then((x) => {
        const projectSlug = x.data?.createFullProject?.project?.slug;

        window.location.href = `/app/${slug}/${projectSlug}`;
      });

      onToggle?.();
      resetData?.();
    },
    [
      createProject,
      namePlaceholder,
      onToggle,
      organizationId,
      resetData,
      selectedTagIds,
      slug,
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
          name: "",
          categoryId: undefined,
          tagIds: [],
        }}
        onSubmit={handleSubmit}
      >
        {({ handleSubmit }) => (
          <Form onSubmit={handleSubmit as any}>
            <ModalContent>
              <ModalHeader>New Project</ModalHeader>
              <ModalCloseButton />
              <ModalBody>
                <VStack alignItems="flex-start">
                  <InputControl
                    label="Name"
                    name="name"
                    inputProps={{ placeholder: namePlaceholder }}
                  />
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

export default CreateProjectModal;
