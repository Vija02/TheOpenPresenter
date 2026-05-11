import { AuthRestrict, SharedLayout } from "@/components/SharedLayout";
import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import {
  ScreenFragment,
  SharedScreenGuestQuery,
  useLogoutScreenGuestSessionMutation,
  useScreenActiveControllerUpdatedSubscription,
} from "@repo/graphql";
import { Button, Link, LoadingFull, Redirect } from "@repo/ui";
import { ReactNode, useEffect, useMemo, useRef } from "react";
import { UseQueryResponse } from "urql";
import { Link as WouterLink, useParams } from "wouter";

export type SharedScreenGuestScreen = ScreenFragment & {
  screenActiveController?: { screenGuestSessionId?: string | null } | null;
};

export type ScreenGuestAuthContext = {
  screen: SharedScreenGuestScreen;
  isMember: boolean;
  currentScreenGuestSessionId: string | null;
  currentScreenGuestSessionKind: "ANON" | "REGISTERED" | null;
  guestHasControl: boolean;
};

type Props = {
  query: UseQueryResponse<SharedScreenGuestQuery>;
  title: (screen: SharedScreenGuestScreen) => string;
  redirectIf?: (ctx: ScreenGuestAuthContext) => string | null;
  children: (ctx: ScreenGuestAuthContext) => ReactNode;
};

export function SharedScreenGuestLayout({
  query,
  title,
  redirectIf,
  children,
}: Props) {
  const orgSlug = useOrganizationSlug();
  const params = useParams();
  const screenSlug = params.screenSlug!;
  const loginHref = `/o/${orgSlug}/screens/${screenSlug}/login`;

  const [{ data, fetching }, refetchQuery] = query;

  const screen = data?.organizationBySlug?.screens.nodes[0] ?? null;
  const organizationId = data?.organizationBySlug?.id ?? null;
  const currentUserId = data?.currentUser?.id ?? null;
  const currentScreenGuestSession = data?.currentScreenGuestSession ?? null;

  const sessionMatchesThisScreen =
    !!currentScreenGuestSession &&
    !!screen &&
    currentScreenGuestSession.screenId === screen.id;
  const effectiveGuestSessionId = sessionMatchesThisScreen
    ? (currentScreenGuestSession?.id ?? null)
    : null;
  const currentScreenGuestSessionKind = sessionMatchesThisScreen
    ? (currentScreenGuestSession?.kind ?? null)
    : null;
  const isMember = useMemo(() => {
    if (!organizationId) return false;
    const memberships = data?.currentUser?.organizationMemberships?.nodes ?? [];
    return memberships.some((m) => m.organization?.id === organizationId);
  }, [organizationId, data?.currentUser]);

  const seatHolderGuestId =
    screen?.screenActiveController?.screenGuestSessionId ?? null;
  const guestHasControl =
    !!effectiveGuestSessionId && effectiveGuestSessionId === seatHolderGuestId;

  const controllerRevoked = useControllerRevoked({
    guestHasControl,
    screen,
    refetch: () => refetchQuery({ requestPolicy: "network-only" }),
  });

  const isAnonGuest = currentScreenGuestSessionKind === "ANON";
  const roleEnabled =
    !screen || !effectiveGuestSessionId
      ? true
      : isAnonGuest
        ? screen.anonGuestEnabled
        : screen.registeredGuestEnabled;
  const shouldKickDisabledRole = !!effectiveGuestSessionId && !roleEnabled;

  const [, logoutGuest] = useLogoutScreenGuestSessionMutation();
  const kickedRef = useRef(false);
  useEffect(() => {
    if (!shouldKickDisabledRole) return;
    if (kickedRef.current) return;
    kickedRef.current = true;
    (async () => {
      await logoutGuest({});

      refetchQuery({ requestPolicy: "network-only" });
    })();
  }, [shouldKickDisabledRole, logoutGuest, refetchQuery]);

  if (fetching && !data) {
    return <LoadingFull />;
  }

  // Logged in but not a member of this org and no guest session
  if (currentUserId && !effectiveGuestSessionId && !isMember) {
    return <Redirect href={loginHref} replace />;
  }
  // Not logged in and no guest session
  if (!currentUserId && !effectiveGuestSessionId) {
    return <Redirect href={loginHref} replace />;
  }
  // Authenticated but no screen (stale session / different screen)
  if (!fetching && data && !screen) {
    return <Redirect href={loginHref} replace />;
  }

  // Processing
  if (!screen || shouldKickDisabledRole) {
    return <LoadingFull />;
  }

  if (controllerRevoked) {
    return (
      <Redirect href={`/o/${orgSlug}/screens/${screenSlug}/ended`} replace />
    );
  }

  const ctx: ScreenGuestAuthContext = {
    screen,
    isMember,
    currentScreenGuestSessionId: effectiveGuestSessionId,
    currentScreenGuestSessionKind,
    guestHasControl,
  };

  const crossRedirect = redirectIf?.(ctx) ?? null;
  if (crossRedirect) {
    return <Redirect href={crossRedirect} replace />;
  }

  const navbarRight = currentUserId ? (
    <Link asChild>
      <WouterLink href="/logout">
        <Button
          size="sm"
          variant="link"
          className="text-tertiary"
          data-testid="header-logout-button"
        >
          Logout
        </Button>
      </WouterLink>
    </Link>
  ) : undefined;

  return (
    <SharedLayout
      title={title(screen)}
      query={query}
      forbidWhen={AuthRestrict.NEVER}
      navbarRight={navbarRight}
    >
      {children(ctx)}
    </SharedLayout>
  );
}

const useControllerRevoked = ({
  guestHasControl,
  screen,
  refetch,
}: {
  screen: ScreenGuestAuthContext["screen"] | null;
  guestHasControl: ScreenGuestAuthContext["guestHasControl"];
  refetch: () => void;
}) => {
  const wasControllerRef = useRef(false);
  if (guestHasControl) {
    wasControllerRef.current = true;
  }
  const controllerRevoked = wasControllerRef.current && !guestHasControl;

  const [acSubResult] = useScreenActiveControllerUpdatedSubscription({
    variables: { screenId: screen?.id ?? "" },
    pause: !guestHasControl,
  });
  const lastAcEventRef = useRef<unknown>(null);
  useEffect(() => {
    const payload = acSubResult.data?.screenActiveControllerUpdated;
    if (!payload) return;
    if (lastAcEventRef.current === payload) return;
    lastAcEventRef.current = payload;
    refetch();
  }, [acSubResult.data, refetch]);

  return controllerRevoked;
};
