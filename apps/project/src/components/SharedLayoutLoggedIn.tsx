import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  OverlayToggle,
} from "@repo/ui";
import * as React from "react";
import { GoOrganization } from "react-icons/go";
import { IoMdSettings } from "react-icons/io";
import { RxHamburgerMenu } from "react-icons/rx";
import { Link as WouterLink } from "wouter";

import { AuthRestrict, SharedLayout, SharedLayoutProps } from "./SharedLayout";
import { contentMinHeight } from "./SharedLayoutSkeleton";
import { DrawerShell } from "./Sidebar/DrawerShell";
import { SidebarItem } from "./Sidebar/SidebarItem";
import { StandardWidth } from "./StandardWidth";
import { useIsMobile } from "./useIsMobile";

export function SharedLayoutLoggedIn(
  props: Omit<SharedLayoutProps, "forbidWhen" | "noPad" | "children"> & {
    children: React.ReactNode;
  },
) {
  const { data } = props.query;

  const isMobile = useIsMobile();

  const navbar = React.useMemo(
    () => (
      <div className="w-full md:w-[250px] self-stretch border-r border-gray-300">
        <div className="stack-row items-start p-3">
          <Avatar className="size-6">
            <AvatarImage src={data?.currentUser?.avatarUrl ?? undefined} />
            <AvatarFallback>
              {data?.currentUser?.name?.charAt(0)?.toUpperCase() ?? "?"}
            </AvatarFallback>
          </Avatar>
          <span>{data?.currentUser?.name}</span>
        </div>
        <hr className="border-gray-200" />
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
        <SidebarItem
          baseUrl="/settings"
          href="/settings/profile"
          icon={<IoMdSettings />}
          name="Settings"
        >
          <SidebarItem href="/settings/profile" name="Profile" />
          <SidebarItem href="/settings/security" name="Password" />
          <SidebarItem href="/settings/emails" name="Emails" />
          <SidebarItem href="/settings/delete" name="Delete Account" />
        </SidebarItem>
      </div>
    ),
    [data?.currentUser?.avatarUrl, data?.currentUser?.name],
  );

  return (
    <SharedLayout
      forbidWhen={AuthRestrict.LOGGED_OUT}
      noPad
      {...props}
      navbarLeft={
        isMobile && (
          <OverlayToggle
            toggler={({ onToggle }) => (
              <Button
                variant="ghost"
                className="hover:bg-transparent"
                onClick={onToggle}
              >
                <RxHamburgerMenu className="size-6 text-gray-400" />
              </Button>
            )}
          >
            <DrawerShell>{navbar}</DrawerShell>
          </OverlayToggle>
        )
      }
      navbarRight={
        <WouterLink href={`/logout`}>
          <Button
            size="sm"
            variant="link"
            className="text-tertiary"
            data-cy="header-logout-button"
          >
            Logout
          </Button>
        </WouterLink>
      }
    >
      <div className="flex" style={{ minHeight: contentMinHeight }}>
        {!isMobile && navbar}
        <StandardWidth style={{ width: "100%" }}>
          {props.children}
        </StandardWidth>
      </div>
    </SharedLayout>
  );
}
