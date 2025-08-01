import { SharedLayoutLoggedIn } from "@/components/SharedLayoutLoggedIn";
import { Box, Heading, Link, Stack, Text } from "@chakra-ui/react";
import { useOrganizationOverviewIndexPageQuery } from "@repo/graphql";
import { Link as WouterLink } from "wouter";

const OrganizationOverview = () => {
  const query = useOrganizationOverviewIndexPageQuery();

  return (
    <SharedLayoutLoggedIn
      title="Organization Overview"
      query={query}
      noHandleErrors
    >
      <Heading>Your Organizations</Heading>
      <Box>
        <Stack
          direction="row"
          alignItems="center"
          marginBottom={2}
          flexWrap="wrap"
        >
          {query.data?.currentUser?.organizationMemberships.nodes.map(
            (membership) => (
              <Box
                key={membership.id}
                as={WouterLink}
                href={"/o/" + membership.organization?.slug}
                cursor="pointer"
                border="1px solid"
                borderColor="gray.200"
                rounded="sm"
                p={2}
                _hover={{ borderColor: "blue.400" }}
              >
                <Text fontWeight="bold" fontSize="lg">
                  {membership.organization?.name}
                </Text>
                <Text>
                  {membership.organization?.projects.totalCount} projects
                </Text>
              </Box>
            ),
          )}
        </Stack>
        {query.data?.currentUser?.organizationMemberships.nodes.length ===
          0 && (
          <Text>
            You are not part of any organization. <br />
            To get started with TheOpenPresenter, please{" "}
            <Link as={WouterLink} href="/org/create-organization">
              create a new organization
            </Link>
          </Text>
        )}
      </Box>
    </SharedLayoutLoggedIn>
  );
};

export default OrganizationOverview;
