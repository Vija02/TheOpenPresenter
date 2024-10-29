import { SharedLayoutLoggedIn } from "@/components/SharedLayoutLoggedIn";
import { Box, Heading, Link, Stack, Text } from "@chakra-ui/react";
import { useOrganizationOverviewIndexPageQuery } from "@repo/graphql";
import { NextPage } from "next";
import NextLink from "next/link";

const OrganizationOverview: NextPage = () => {
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
                as={NextLink}
                href={"/o/" + membership.organization?.slug}
                cursor="pointer"
                border="1px solid"
                borderColor="gray.200"
                rounded="sm"
                p={2}
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
            <Link as={NextLink} href="/org/create-organization">
              create a new organization
            </Link>
          </Text>
        )}
      </Box>
    </SharedLayoutLoggedIn>
  );
};

export default OrganizationOverview;
