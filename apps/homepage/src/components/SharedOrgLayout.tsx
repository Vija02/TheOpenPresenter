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
import { IoMdArrowBack, IoMdSettings } from "react-icons/io";
import { PiProjectorScreenChartLight } from "react-icons/pi";
import { RxHamburgerMenu } from "react-icons/rx";

import { AuthRestrict, SharedLayout, SharedLayoutProps } from "./SharedLayout";
import { contentMinHeight } from "./SharedLayoutSkeleton";
import { DrawerShell } from "./Sidebar/DrawerShell";
import { SidebarItem } from "./Sidebar/SidebarItem";
import { StandardWidth } from "./StandardWidth";
import { useIsMobile } from "./useIsMobile";

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

  const isMobile = useIsMobile();

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
        width={{ base: "100%", md: "250px" }}
        alignSelf="stretch"
        borderRight="1px solid rgb(217, 217, 217)"
      >
        <Stack direction="row" alignItems="stretch" spacing={0}>
          <Box
            as={NextLink}
            href="/org/overview"
            display="flex"
            alignItems="center"
            flexShrink={0}
            _hover={{ bg: "blue.50" }}
          >
            <Icon fontSize="20px" cursor="pointer" px={3} width="100%">
              <IoMdArrowBack />
            </Icon>
          </Box>
          <Stack
            direction="row"
            p={3}
            pl={0}
            alignItems="center"
            overflow="hidden"
            flex={1}
          >
            <Avatar
              size="xs"
              src={data?.organizationBySlug?.name ?? undefined}
              name={data?.organizationBySlug?.name ?? ""}
            />
            <Text textOverflow="ellipsis" overflow="hidden" whiteSpace="nowrap">
              {data?.organizationBySlug?.name}
            </Text>
          </Stack>
        </Stack>
        <Divider />
        <SidebarItem
          href={`/o/${slug}`}
          icon={<PiProjectorScreenChartLight />}
          name="Projects"
          exact
        />
        <SidebarItem
          baseUrl={`/o/${slug}/settings`}
          href={`/o/${slug}/settings/general`}
          icon={<IoMdSettings />}
          name="Settings"
        >
          <SidebarItem href={`/o/${slug}/settings/general`} name="General" />
          <SidebarItem href={`/o/${slug}/settings/tags`} name="Tags" />
          <SidebarItem
            href={`/o/${slug}/settings/categories`}
            name="Categories"
          />
          <SidebarItem href={`/o/${slug}/settings/members`} name="Members" />
          <SidebarItem
            href={`/o/${slug}/settings/leave`}
            name="Leave Organization"
          />
          <SidebarItem
            href={`/o/${slug}/settings/delete`}
            name="Delete Organization"
          />
        </SidebarItem>
      </Box>
    ),
    [data?.organizationBySlug?.name, slug],
  );

  return (
    <globalState.modelDataAccess.TagProvider key="TagProvider" slug={slug}>
      <SharedLayout
        forbidWhen={AuthRestrict.LOGGED_OUT}
        noPad
        query={sharedOrgQuery}
        {...props}
        navbarLeft={
          isMobile && (
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
          )
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
            {!isMobile && navbar}
            <StandardWidth style={{ width: "100%" }}>
              {props.children}
            </StandardWidth>
          </Box>
        )}
      </SharedLayout>
    </globalState.modelDataAccess.TagProvider>
  );
}
