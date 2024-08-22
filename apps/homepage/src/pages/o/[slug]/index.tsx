import SharedOrgLayout from "@/components/SharedOrgLayout";
import { StandardWidth } from "@/components/StandardWidth";
import {
  useOrganizationLoading,
  useOrganizationSlug,
} from "@/lib/permissionHooks/organization";
import {
  Button,
  HStack,
  Heading,
  LinkBox,
  LinkOverlay,
  Text,
} from "@chakra-ui/react";
import {
  useCreateProjectMutation,
  useOrganizationDashboardIndexPageQuery,
} from "@repo/graphql";
import { DateDisplayRelative } from "@repo/ui";
import { NextPage } from "next";
import { generateSlug } from "random-word-slugs";

const OrganizationPage: NextPage = () => {
  const slug = useOrganizationSlug();
  const query = useOrganizationDashboardIndexPageQuery({ variables: { slug } });
  const organizationLoadingElement = useOrganizationLoading(query);
  const [createProject] = useCreateProjectMutation();

  return (
    <SharedOrgLayout title="Dashboard" sharedOrgQuery={query}>
      {organizationLoadingElement || (
        <StandardWidth>
          <Heading mb={3}>Projects</Heading>
          <HStack alignItems="center" marginBottom={2}>
            {query.data?.organizationBySlug?.projects.nodes.map(
              (project, i) => (
                <LinkBox
                  key={i}
                  boxShadow="base"
                  p={2}
                  border="1px solid"
                  borderColor="gray.100"
                  _hover={{ borderColor: "blue.400" }}
                >
                  <LinkOverlay href={`/app/${slug}/${project.slug}`}>
                    {project.slug}
                  </LinkOverlay>
                  <Text color="gray.600" fontSize="sm">
                    Updated{" "}
                    <DateDisplayRelative date={new Date(project.updatedAt)} />
                  </Text>
                </LinkBox>
              ),
            )}
          </HStack>

          <Button
            onClick={() => {
              createProject({
                variables: {
                  creatorUserId: query.data?.currentUser?.id,
                  organizationId: query.data?.organizationBySlug?.id,
                  slug: generateSlug(),
                },
              }).then((x) => {
                const projectSlug = x.data?.createProject?.project?.slug;

                window.location.href = `/app/${slug}/${projectSlug}`;
              });
            }}
          >
            Create new project
          </Button>
        </StandardWidth>
      )}
    </SharedOrgLayout>
  );
};

export default OrganizationPage;
