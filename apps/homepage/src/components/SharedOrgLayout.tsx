import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import { QueryResult } from "@apollo/client";
import { Box } from "@chakra-ui/react";
import { projectName } from "@repo/config";
import {
  SharedOrganizationFragment,
  useCurrentUserUpdatedSubscription,
} from "@repo/graphql";
import { globalState } from "@repo/lib";
import Head from "next/head";
import { useRouter } from "next/router";
import React, { useEffect } from "react";

import { Redirect } from "./Redirect";
import { AuthRestrict } from "./SharedLayout";

/* The Apollo `useSubscription` hook doesn't currently allow skipping the
 * subscription; we only want it when the user is logged in, so we conditionally
 * call this stub component.
 */
function CurrentUserUpdatedSubscription() {
  /*
   * This will set up a GraphQL subscription monitoring for changes to the
   * current user. Interestingly we don't need to actually _do_ anything - no
   * rendering or similar - because the payload of this mutation will
   * automatically update Apollo's cache which will cause the data to be
   * re-rendered wherever appropriate.
   */
  useCurrentUserUpdatedSubscription();
  return null;
}

type PropTypes = {
  children?: React.ReactNode;
  sharedOrgQuery: Pick<
    QueryResult<SharedOrganizationFragment>,
    "data" | "loading" | "error" | "networkStatus" | "client" | "refetch"
  >;
  title?: string;
  forbidWhen?: AuthRestrict;
};

export default function SharedOrgLayout({
  children,
  sharedOrgQuery,
  title,
  forbidWhen = AuthRestrict.LOGGED_OUT,
}: PropTypes) {
  const slug = useOrganizationSlug();
  const router = useRouter();

  // Update last selected organization
  const setLastSelectedOrganizationId =
    globalState.organization.useLastSelectedOrganizationId(
      (x) => x.setLastSelectedOrganizationId,
    );

  useEffect(() => {
    if (sharedOrgQuery.data?.currentUser) {
      const membership =
        sharedOrgQuery.data.currentUser?.organizationMemberships?.nodes.find(
          (membership) => membership.organization?.slug === slug,
        );

      if (membership) {
        setLastSelectedOrganizationId(membership.organization?.id);
      }
    }
  }, [setLastSelectedOrganizationId, sharedOrgQuery.data?.currentUser, slug]);

  const forbidsLoggedIn = forbidWhen & AuthRestrict.LOGGED_IN;
  const forbidsLoggedOut = forbidWhen & AuthRestrict.LOGGED_OUT;
  const forbidsNotAdmin = forbidWhen & AuthRestrict.NOT_ADMIN;

  if (
    sharedOrgQuery.data &&
    sharedOrgQuery.data.currentUser &&
    (forbidsLoggedIn ||
      (forbidsNotAdmin && !sharedOrgQuery.data.currentUser.isAdmin))
  ) {
    return <Redirect href={"/"} />;
  } else if (
    sharedOrgQuery.data &&
    sharedOrgQuery.data.currentUser === null &&
    !sharedOrgQuery.loading &&
    !sharedOrgQuery.error &&
    forbidsLoggedOut
  ) {
    return (
      <Redirect href={`/login?next=${encodeURIComponent(router.asPath)}`} />
    );
  }

  return (
    <>
      <CurrentUserUpdatedSubscription />
      <Box display="flex" position="relative">
        <Head>
          <title>{title ? `${title} — ${projectName}` : projectName}</title>
        </Head>
        <MainPanel>{children}</MainPanel>
      </Box>
    </>
  );
}

type MainPanelPropTypes = {
  children: React.ReactNode;
};

const MainPanel = ({ children }: MainPanelPropTypes) => {
  return (
    <Box display="flex" flexDirection="column" height="100vh" width="100%">
      <Box overflowY="auto" overflowX="hidden" height="100vh">
        {children}
      </Box>
    </Box>
  );
};
