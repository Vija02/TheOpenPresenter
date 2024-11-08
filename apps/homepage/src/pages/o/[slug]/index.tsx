import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import { Tag } from "@/components/Tag";
import CreateProjectModal from "@/containers/CreateProjectModal";
import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import {
  Button,
  Flex,
  Heading,
  LinkBox,
  LinkOverlay,
  Text,
  VStack,
  chakra,
} from "@chakra-ui/react";
import {
  useDeleteProjectMutation,
  useOrganizationDashboardIndexPageQuery,
} from "@repo/graphql";
import { globalState } from "@repo/lib";
import { DateDisplayRelative, OverlayToggle, PopConfirm } from "@repo/ui";
import { NextPage } from "next";
import { useCallback } from "react";
import { FaPlus } from "react-icons/fa";
import { VscTrash as VscTrashRaw } from "react-icons/vsc";
import { toast } from "react-toastify";

const VscTrash = chakra(VscTrashRaw);

const OrganizationPage: NextPage = () => {
  const slug = useOrganizationSlug();
  const query = useOrganizationDashboardIndexPageQuery({ variables: { slug } });

  const { publish } = globalState.modelDataAccess.usePublishAPIChanges({
    token: "page",
  });

  const [deleteProject] = useDeleteProjectMutation({
    onCompleted: publish,
  });

  const handleDeleteProject = useCallback(
    async (id: string) => {
      try {
        await deleteProject({
          variables: {
            id,
          },
        });
        toast.success("Project successfully deleted");
      } catch (e: any) {
        toast.error("Error occurred when deleting this project: " + e.message);
      }
    },
    [deleteProject],
  );

  return (
    <SharedOrgLayout title="Dashboard" sharedOrgQuery={query}>
      <Flex px={1} alignItems="center" justifyContent="space-between" mb={3}>
        <Heading mb={0}>Projects</Heading>
        <OverlayToggle
          toggler={({ onToggle }) => (
            <Button
              colorScheme="green"
              size="sm"
              display="flex"
              gap={2}
              onClick={onToggle}
            >
              <FaPlus />
              New
            </Button>
          )}
        >
          <CreateProjectModal
            organizationId={query.data?.organizationBySlug?.id}
            categories={query.data?.organizationBySlug?.categories.nodes ?? []}
          />
        </OverlayToggle>
      </Flex>

      <VStack alignItems="center" marginBottom={2} flexWrap="wrap" spacing={0}>
        {query.data?.organizationBySlug?.projects.nodes.map((project, i) => (
          <LinkBox
            key={project.id}
            display="flex"
            flexDir={{ base: "column", sm: "row" }}
            width="100%"
            py={2}
            px={1}
            justifyContent="space-between"
            _hover={{ bg: "blue.50" }}
            borderBottom={{ base: "1px solid", sm: "none" }}
            borderColor="gray.200"
            role="group"
          >
            <Flex
              alignItems="center"
              gap={2}
              justifyContent={{ base: "space-between", sm: "flex-start" }}
            >
              <LinkOverlay href={`/app/${slug}/${project.slug}`}>
                <Text fontWeight={{ base: 600, sm: 500 }}>
                  {project.name !== "" ? project.name : project.slug}
                </Text>
                <Text fontSize="xs" color="gray.500">
                  {project.category?.name}
                </Text>
              </LinkOverlay>
              <Flex>
                <PopConfirm
                  title={`Are you sure you want to delete this project? This action is not reversible.`}
                  onConfirm={() => handleDeleteProject(project.id)}
                  okText="Yes"
                  cancelText="No"
                  key="remove"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    role="button"
                    color="gray"
                    _hover={{ bg: "red.50", color: "red.400" }}
                    opacity={{ base: 1, md: 0 }}
                    _groupHover={{ opacity: 1 }}
                  >
                    <VscTrash />
                  </Button>
                </PopConfirm>
              </Flex>
            </Flex>
            <Flex
              flexDir={{ base: "column-reverse", sm: "row" }}
              gap={{ base: 1, sm: 4 }}
              alignItems={{ base: "flex-start", sm: "center" }}
            >
              <Flex gap={1}>
                {project.projectTags.nodes.map((projectTag, i) => (
                  <Tag key={i} tag={projectTag.tag!} />
                ))}
              </Flex>
              <Text color="gray.700" fontSize="xs">
                Updated{" "}
                <DateDisplayRelative date={new Date(project.updatedAt)} />
              </Text>
            </Flex>
          </LinkBox>
        ))}
      </VStack>

      <OverlayToggle
        toggler={({ onToggle }) => (
          <Button onClick={onToggle} colorScheme="green" display="flex" gap={2}>
            <FaPlus />
            New project
          </Button>
        )}
      >
        <CreateProjectModal
          organizationId={query.data?.organizationBySlug?.id}
          categories={query.data?.organizationBySlug?.categories.nodes ?? []}
        />
      </OverlayToggle>
    </SharedOrgLayout>
  );
};

export default OrganizationPage;
