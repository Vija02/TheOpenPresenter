import { useScreenActiveControllerUpdatedSubscription } from "@repo/graphql";
import { usePluginMetaData } from "@repo/shared";
import { ReactNode, useEffect, useRef } from "react";
import { useSearch } from "wouter";

// Handle if/when guest session is terminated
export function GuestControlGuard({ children }: { children: ReactNode }) {
  const { screenGuestSession: session } = usePluginMetaData();
  const screen = session?.screen ?? null;
  const search = useSearch();

  const [acSubResult] = useScreenActiveControllerUpdatedSubscription({
    variables: { screenId: screen?.id ?? "" },
    pause: !screen,
  });

  const subEvent = acSubResult.data?.screenActiveControllerUpdated;
  const controllerId =
    (subEvent ? subEvent.activeController : screen?.screenActiveController)
      ?.screenGuestSessionId ?? null;
  const guestHasControl = !!session && controllerId === session.id;

  const wasControllerRef = useRef(false);
  if (guestHasControl) wasControllerRef.current = true;
  const revoked = wasControllerRef.current && !guestHasControl;

  useEffect(() => {
    if (!revoked || !screen?.organization?.slug || !screen.slug) return;
    const base = `/o/${screen.organization.slug}/screens/${screen.slug}/ended`;
    window.location.replace(search ? `${base}?${search}` : base);
  }, [revoked, screen, search]);

  return <>{children}</>;
}
