import { PopConfirm } from "@/components/PopConfirm";
import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import { Tag } from "@/components/Tag";
import CreateProjectModal from "@/containers/CreateProjectModal";
import EditProjectModal from "@/containers/EditProjectModal";
import ImportProjectModal from "@/containers/ImportProjectModal";
import { getServerSidePropsDeviceType, withDeviceType } from "@/lib/DeviceType";
import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import {
  Box,
  Button,
  Flex,
  Heading,
  Link,
  LinkBox,
  LinkOverlay,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  CategoryFragment,
  ProjectFragment,
  useDeleteProjectMutation,
  useOrganizationDashboardIndexPageQuery,
} from "@repo/graphql";
import { globalState } from "@repo/lib";
import { DateDisplay, DateDisplayRelative, OverlayToggle } from "@repo/ui";
import { format } from "date-fns";
import { NextPage } from "next";
import { useCallback, useMemo } from "react";
import { FaFileImport, FaPlus } from "react-icons/fa";
import { MdCoPresent } from "react-icons/md";
import { VscEdit, VscTrash } from "react-icons/vsc";
import { toast } from "react-toastify";

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

  const emptyProject = useMemo(
    () => query.data?.organizationBySlug?.projects.nodes.length === 0,
    [query.data?.organizationBySlug?.projects.nodes.length],
  );

  return (
    <SharedOrgLayout title="Dashboard" sharedOrgQuery={query}>
      <Flex px={1} alignItems="center" justifyContent="space-between" mb={3}>
        <Heading mb={0}>Projects</Heading>
        <Stack direction="row">
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
              categories={
                query.data?.organizationBySlug?.categories.nodes ?? []
              }
            />
          </OverlayToggle>
          <OverlayToggle
            toggler={({ onToggle }) => (
              <Button
                variant="outline"
                size="sm"
                display="flex"
                gap={2}
                onClick={onToggle}
              >
                <FaFileImport />
                Import
              </Button>
            )}
          >
            <ImportProjectModal
              organizationId={query.data?.organizationBySlug?.id}
            />
          </OverlayToggle>
        </Stack>
      </Flex>

      <VStack alignItems="center" marginBottom={2} flexWrap="wrap" spacing={0}>
        {emptyProject && <EmptyProject />}
        {query.data?.organizationBySlug?.projects.nodes.map((project) => (
          <ProjectCard
            project={project}
            organizationId={query.data?.organizationBySlug?.id}
            categories={query.data?.organizationBySlug?.categories.nodes ?? []}
            handleDeleteProject={handleDeleteProject}
          />
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

const EmptyProject = () => {
  return (
    <Box mt={3} w="100%">
      <Text fontSize="lg" fontWeight="bold">
        Welcome to your projects page!
      </Text>
      <Text>
        There's currently nothing here. Create a new project to get started.
      </Text>
    </Box>
  );
};

const ProjectCard = ({
  project,
  organizationId,
  categories,
  handleDeleteProject,
}: {
  project: ProjectFragment;
  organizationId: string;
  categories: CategoryFragment[];
  handleDeleteProject: (projectId: string) => void;
}) => {
  const slug = useOrganizationSlug();
  return (
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
      data-testid="project-card"
    >
      <Flex
        alignItems="center"
        gap={2}
        justifyContent={{ base: "space-between", sm: "flex-start" }}
      >
        <LinkOverlay href={`/app/${slug}/${project.slug}`}>
          {project.targetDate && (
            <DateDisplay
              date={new Date(project.targetDate)}
              formatToken="do MMM yyyy"
              className="text-sm font-bold sm:font-medium"
            />
          )}
          <Text fontSize={project.targetDate ? "xs" : "sm"}>
            {project.name !== ""
              ? project.name
              : project.targetDate
                ? ""
                : `Untitled (${format(new Date(project.createdAt), "do MMM yyyy")})`}
          </Text>
          <Text fontSize="xs" color="gray.500">
            {project.category?.name}
          </Text>
        </LinkOverlay>
        <Flex>
          <Link href={`/render/${slug}/${project.slug}`} isExternal>
            <Button
              variant="ghost"
              size="sm"
              role="button"
              color="gray"
              _hover={{ bg: "blue.100", color: "blue.700" }}
              opacity={{ base: 1, md: 0 }}
              _groupHover={{ opacity: 1 }}
            >
              <MdCoPresent />
            </Button>
          </Link>
          <OverlayToggle
            toggler={({ onToggle }) => (
              <Button
                variant="ghost"
                size="sm"
                role="button"
                color="gray"
                _hover={{ bg: "blue.100", color: "blue.700" }}
                opacity={{ base: 1, md: 0 }}
                _groupHover={{ opacity: 1 }}
                onClick={onToggle}
              >
                <VscEdit />
              </Button>
            )}
          >
            <EditProjectModal
              project={project}
              organizationId={organizationId}
              categories={categories}
            />
          </OverlayToggle>

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
        <Text color="gray.700" fontSize="xs" textAlign="right">
          Updated <DateDisplayRelative date={new Date(project.updatedAt)} />
        </Text>
      </Flex>
    </LinkBox>
  );
};

export const getServerSideProps = getServerSidePropsDeviceType;

export default withDeviceType(OrganizationPage);
