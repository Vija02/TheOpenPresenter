import {
  useOrganizationLoading,
  useOrganizationSlug,
} from "@/lib/permissionHooks/organization";
import { SharedOrganizationFragment } from "@repo/graphql";
import { globalState } from "@repo/lib";
import {
  Avatar,
  AvatarFallback,
  Button,
  OverlayToggle,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
  useOverlayToggle,
} from "@repo/ui";
import * as React from "react";
import { useEffect } from "react";
import { FaCheck, FaCloud } from "react-icons/fa";
import { IoMdArrowBack, IoMdSettings } from "react-icons/io";
import { LuChevronsUpDown } from "react-icons/lu";
import { MdPermMedia } from "react-icons/md";
import {
  PiProjectorScreenChartLight,
  PiTelevisionSimple,
} from "react-icons/pi";
import { RxHamburgerMenu } from "react-icons/rx";
import { UseQueryResponse } from "urql";
import { Link as WouterLink } from "wouter";

import { AuthRestrict, SharedLayout, SharedLayoutProps } from "./SharedLayout";
import { contentMinHeight } from "./SharedLayoutSkeleton";
import { DrawerShell } from "./Sidebar/DrawerShell";
import { SidebarItem } from "./Sidebar/SidebarItem";
import { StandardWidth } from "./StandardWidth";
import { useIsMobile } from "./useIsMobile";

type OrgMembership = NonNullable<
  NonNullable<
    SharedOrganizationFragment["currentUser"]
  >["organizationMemberships"]
>["nodes"][number];

function OrgSwitcherMenu({
  memberships,
  slug,
}: {
  memberships: OrgMembership[];
  slug: string;
}) {
  const { onToggle } = useOverlayToggle();
  const closeDrawer = () => onToggle?.();

  return (
    <>
      <div className="text-xs text-tertiary px-2 py-1">Switch organization</div>
      <div className="flex flex-col max-h-[300px] overflow-y-auto">
        {memberships.map((membership) => {
          const org = membership.organization;
          if (!org) return null;
          const isCurrent = org.slug === slug;
          return (
            <PopoverClose asChild key={org.id}>
              <WouterLink
                href={`/o/${org.slug}`}
                onClick={closeDrawer}
                className={`flex items-center gap-2 px-2 py-2 rounded text-primary no-underline hover:no-underline hover:bg-surface-primary-hover cursor-pointer ${
                  isCurrent
                    ? "bg-surface-primary-active hover:bg-surface-primary-active"
                    : ""
                }`}
              >
                <Avatar className="size-6">
                  <AvatarFallback>
                    {org.name?.charAt(0)?.toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="text-ellipsis overflow-hidden whitespace-nowrap flex-1 text-sm">
                  {org.name}
                </div>
                {isCurrent && (
                  <FaCheck className="size-3 flex-shrink-0 text-tertiary" />
                )}
              </WouterLink>
            </PopoverClose>
          );
        })}
      </div>
      <div className="border-t border-stroke-disabled my-1"></div>
      <PopoverClose asChild>
        <WouterLink
          href="/org/overview"
          onClick={closeDrawer}
          className="block px-2 py-2 rounded text-secondary hover:text-primary no-underline hover:no-underline hover:bg-surface-primary-hover cursor-pointer text-sm"
        >
          View all organizations
        </WouterLink>
      </PopoverClose>
    </>
  );
}

export function SharedOrgLayout({
  sharedOrgQuery,
  ...props
}: Omit<SharedLayoutProps, "forbidWhen" | "noPad" | "children" | "query"> & {
  children: React.ReactNode;
  sharedOrgQuery: UseQueryResponse<SharedOrganizationFragment>;
}) {
  const slug = useOrganizationSlug();
  const result = sharedOrgQuery[0];
  const { data } = result;
  const organizationLoadingElement = useOrganizationLoading(sharedOrgQuery);

  // Update last selected organization
  const setLastSelectedOrganizationId =
    globalState.organization.useLastSelectedOrganizationId(
      (x) => x.setLastSelectedOrganizationId,
    );

  const isMobile = useIsMobile();

  useEffect(() => {
    if (result.data?.currentUser) {
      const membership =
        result.data.currentUser?.organizationMemberships?.nodes.find(
          (membership) => membership.organization?.slug === slug,
        );

      if (membership) {
        setLastSelectedOrganizationId(membership.organization?.id);
      }
    }
  }, [setLastSelectedOrganizationId, result.data?.currentUser, slug]);

  const memberships = React.useMemo(
    () => data?.currentUser?.organizationMemberships?.nodes ?? [],
    [data?.currentUser?.organizationMemberships?.nodes],
  );

  const navbar = React.useMemo(
    () => (
      <div className="w-full md:w-[250px] self-stretch border-r border-stroke">
        <div className="flex items-stretch">
          <WouterLink
            href="/org/overview"
            className="flex items-center flex-shrink-0 hover:bg-surface-primary-hover text-tertiary no-underline hover:no-underline"
            role="button"
            aria-label="Back to organization overview"
          >
            <IoMdArrowBack className="size-4 cursor-pointer px-3 w-full" />
          </WouterLink>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="stack-row p-3 pl-1 overflow-hidden flex-1 hover:bg-surface-primary-hover cursor-pointer text-left text-primary"
                aria-label="Switch organization"
              >
                <Avatar className="size-6">
                  <AvatarFallback>
                    {data?.organizationBySlug?.name?.charAt(0)?.toUpperCase() ??
                      "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="text-ellipsis overflow-hidden whitespace-nowrap flex-1">
                  {data?.organizationBySlug?.name}
                </div>
                <LuChevronsUpDown className="size-3 flex-shrink-0 text-tertiary mr-2" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-[240px] p-1 z-[100]"
              hideCloseButton
              hideArrow
            >
              <OrgSwitcherMenu memberships={memberships} slug={slug} />
            </PopoverContent>
          </Popover>
        </div>
        <div className="border-t border-stroke-disabled"></div>
        <SidebarItem
          href={`/o/${slug}`}
          icon={<PiProjectorScreenChartLight />}
          name="Projects"
          exact
        />
        <SidebarItem
          href={`/o/${slug}/screens`}
          icon={<PiTelevisionSimple />}
          name="Screens"
        />
        {data?.cloudEnabled && (
          <SidebarItem
            href={`/o/${slug}/cloud`}
            icon={<FaCloud />}
            name="Cloud"
            exact
          />
        )}
        <SidebarItem
          href={`/o/${slug}/media`}
          icon={<MdPermMedia />}
          name="Media"
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
      </div>
    ),
    [data?.cloudEnabled, data?.organizationBySlug?.name, memberships, slug],
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
              data-testid="header-logout-button"
            >
              Logout
            </Button>
          </WouterLink>
        }
      >
        {organizationLoadingElement || (
          <div className="flex" style={{ minHeight: contentMinHeight }}>
            {!isMobile && navbar}
            <StandardWidth style={{ width: "100%" }}>
              {props.children}
            </StandardWidth>
          </div>
        )}
      </SharedLayout>
    </globalState.modelDataAccess.TagProvider>
  );
}
