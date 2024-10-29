import {
  useOrganizationLoading,
  useOrganizationSlug,
} from "@/lib/permissionHooks/organization";
import { QueryResult } from "@apollo/client";
import {
  Avatar,
  Box,
  Button,
  Divider,
  Icon,
  Link,
  Show,
  Stack,
  Text,
  Wrap,
} from "@chakra-ui/react";
import { SharedOrganizationFragment } from "@repo/graphql";
import { globalState } from "@repo/lib";
import { OverlayToggle } from "@repo/ui";
import NextLink from "next/link";
import * as React from "react";
import { useEffect } from "react";
import { IoMdSettings } from "react-icons/io";
import { PiProjectorScreenChartLight } from "react-icons/pi";
import { RxHamburgerMenu } from "react-icons/rx";

import { AuthRestrict, SharedLayout, SharedLayoutProps } from "./SharedLayout";
import { contentMinHeight } from "./SharedLayoutSkeleton";
import { DrawerShell } from "./Sidebar/DrawerShell";
import { SidebarItem } from "./Sidebar/SidebarItem";
import { StandardWidth } from "./StandardWidth";

export function SharedOrgLayout({
  sharedOrgQuery,
  ...props
}: Omit<SharedLayoutProps, "forbidWhen" | "noPad" | "children" | "query"> & {
  children: React.ReactNode;
  sharedOrgQuery: Pick<
    QueryResult<SharedOrganizationFragment>,
    "data" | "loading" | "error" | "networkStatus" | "client" | "refetch"
  >;
}) {
  const slug = useOrganizationSlug();
  const { data } = sharedOrgQuery;
  const organizationLoadingElement = useOrganizationLoading(sharedOrgQuery);

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

  const navbar = React.useMemo(
    () => (
      <Box
        width="250px"
        alignSelf="stretch"
        borderRight="1px solid rgb(217, 217, 217)"
      >
        <Stack direction="row" p={3} alignItems="center">
          <Avatar
            size="xs"
            src={data?.currentUser?.avatarUrl ?? undefined}
            name={data?.currentUser?.name ?? ""}
          />
          <Text>{data?.currentUser?.name}</Text>
        </Stack>
        <Divider />
        <SidebarItem
          href={`/o/${slug}`}
          icon={<PiProjectorScreenChartLight />}
          name="Projects"
        />
        <SidebarItem
          href={`/o/${slug}/settings`}
          icon={<IoMdSettings />}
          name="Settings"
        >
          <SidebarItem href={`/o/${slug}/settings/profile`} name="Profile" />
          <SidebarItem href={`/o/${slug}/settings/security`} name="Password" />
          <SidebarItem href={`/o/${slug}/settings/emails`} name="Emails" />
          <SidebarItem
            href={`/o/${slug}/settings/delete`}
            name="Delete Account"
          />
        </SidebarItem>
      </Box>
    ),
    [data?.currentUser?.avatarUrl, data?.currentUser?.name, slug],
  );

  return (
    <SharedLayout
      forbidWhen={AuthRestrict.LOGGED_OUT}
      noPad
      query={sharedOrgQuery}
      {...props}
      navbarLeft={
        <Show below="md">
          <OverlayToggle
            toggler={({ onToggle }) => (
              <Button
                variant="ghost"
                _hover={{ bg: "none" }}
                onClick={onToggle}
              >
                <Icon color="white" fontSize="24px">
                  <RxHamburgerMenu />
                </Icon>
              </Button>
            )}
          >
            <DrawerShell>{navbar}</DrawerShell>
          </OverlayToggle>
        </Show>
      }
      navbarRight={
        <Wrap>
          <Stack direction="row" spacing={6}>
            <Link as={NextLink} href={`/logout`} variant="linkButton">
              <Button size="sm" variant="link" data-cy="header-logout-button">
                Logout
              </Button>
            </Link>
          </Stack>
        </Wrap>
      }
    >
      {organizationLoadingElement || (
        <Box display="flex" minHeight={contentMinHeight}>
          <Show above="md">{navbar}</Show>
          <StandardWidth width="100%">{props.children}</StandardWidth>
        </Box>
      )}
    </SharedLayout>
  );
}
