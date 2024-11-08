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
} from "@chakra-ui/react";
import { useOrganizationDashboardIndexPageQuery } from "@repo/graphql";
import { DateDisplayRelative, OverlayToggle } from "@repo/ui";
import { NextPage } from "next";
import { FaPlus } from "react-icons/fa";

const OrganizationPage: NextPage = () => {
  const slug = useOrganizationSlug();
  const query = useOrganizationDashboardIndexPageQuery({ variables: { slug } });

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
            key={i}
            display="flex"
            flexDir={{ base: "column", sm: "row" }}
            width="100%"
            py={2}
            px={1}
            justifyContent="space-between"
            _hover={{ bg: "blue.50" }}
            borderBottom={{ base: "1px solid", sm: "none" }}
            borderColor="gray.200"
          >
            <Flex alignItems="center">
              <LinkOverlay href={`/app/${slug}/${project.slug}`}>
                <Text fontWeight={{ base: 600, sm: 500 }}>
                  {project.name !== "" ? project.name : project.slug}
                </Text>
                <Text fontSize="xs" color="gray.500">
                  {project.category?.name}
                </Text>
              </LinkOverlay>
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
