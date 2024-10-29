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
import { OverlayToggle } from "@repo/ui";
import NextLink from "next/link";
import * as React from "react";
import { GoOrganization } from "react-icons/go";
import { IoMdSettings } from "react-icons/io";
import { RxHamburgerMenu } from "react-icons/rx";

import { AuthRestrict, SharedLayout, SharedLayoutProps } from "./SharedLayout";
import { contentMinHeight } from "./SharedLayoutSkeleton";
import { DrawerShell } from "./Sidebar/DrawerShell";
import { SidebarItem } from "./Sidebar/SidebarItem";
import { StandardWidth } from "./StandardWidth";

export function SharedLayoutLoggedIn(
  props: Omit<SharedLayoutProps, "forbidWhen" | "noPad" | "children"> & {
    children: React.ReactNode;
  },
) {
  const { data } = props.query;

  const navbar = React.useMemo(
    () => (
      <Box
        width={{ base: "100%", md: "250px" }}
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
          baseUrl="/org"
          href="/org/overview"
          icon={<GoOrganization />}
          name="Organizations"
        >
          <SidebarItem href="/org/overview" name="Overview" />
          <SidebarItem href="/org/create-organization" name="Create new" />
          <SidebarItem href="/org/join-organization" name="Join existing" />
        </SidebarItem>
        <SidebarItem href="/settings" icon={<IoMdSettings />} name="Settings">
          <SidebarItem href="/settings/profile" name="Profile" />
          <SidebarItem href="/settings/security" name="Password" />
          <SidebarItem href="/settings/emails" name="Emails" />
          <SidebarItem href="/settings/delete" name="Delete Account" />
        </SidebarItem>
      </Box>
    ),
    [data?.currentUser?.avatarUrl, data?.currentUser?.name],
  );

  return (
    <SharedLayout
      forbidWhen={AuthRestrict.LOGGED_OUT}
      noPad
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
      <Box display="flex" minHeight={contentMinHeight}>
        <Show above="md">{navbar}</Show>
        <StandardWidth width="100%">{props.children}</StandardWidth>
      </Box>
    </SharedLayout>
  );
}
