import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import ExistingMembers from "@/containers/Settings/Members/ExistingMembers";
import InviteNewMember from "@/containers/Settings/Members/InviteNewMember";
import {
  useOrganizationLoading,
  useOrganizationSlug,
} from "@/lib/permissionHooks/organization";
import { QueryResult } from "@apollo/client";
import { Box, Heading } from "@chakra-ui/react";
import {
  Exact,
  OrganizationSettingsMembersPageQuery,
  OrganizationSettingsMembersPageQueryVariables,
  useOrganizationSettingsMembersPageQuery,
} from "@repo/graphql";
import { useState } from "react";

// This needs to match the `first:` used in Members.graphql
const RESULTS_PER_PAGE = 10;

const OrganizationSettingsIndexPage = () => {
  const slug = useOrganizationSlug();
  const [page, setPage] = useState(0);
  const query = useOrganizationSettingsMembersPageQuery({
    variables: {
      slug,
      offset: page * RESULTS_PER_PAGE,
    },
  });

  const organizationLoadingElement = useOrganizationLoading(query);

  return (
    <SharedOrgLayout title="Organization Members" sharedOrgQuery={query}>
      {organizationLoadingElement || (
        <OrganizationSettingsIndexPageInner
          query={query}
          page={page}
          setPage={setPage}
        />
      )}
    </SharedOrgLayout>
  );
};

type PropTypes = {
  query: QueryResult<
    OrganizationSettingsMembersPageQuery,
    Exact<OrganizationSettingsMembersPageQueryVariables>
  >;
  page: number;
  setPage: (newPage: number) => void;
};

const OrganizationSettingsIndexPageInner = ({
  query,
  page,
  setPage,
}: PropTypes) => {
  const organization = query.data?.organizationBySlug!;

  return (
    <>
      <Heading>Members</Heading>

      {organization.currentUserIsOwner && (
        <>
          <InviteNewMember organization={organization} />
          <Box my={3} />
        </>
      )}

      <ExistingMembers query={query} page={page} setPage={setPage} />
    </>
  );
};

export default OrganizationSettingsIndexPage;
