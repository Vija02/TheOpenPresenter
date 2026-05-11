import {
  useRemoteBasePluginQuery,
  useScreenActiveControllerUpdatedSubscription,
} from "@repo/graphql";
import { ReactNode, useEffect, useRef } from "react";
import { useParams } from "wouter";

// Handle if/when guest session is terminated
export function GuestControlGuard({ children }: { children: ReactNode }) {
  const { orgSlug, projectSlug } = useParams<{
    orgSlug: string;
    projectSlug: string;
  }>();

  const [{ data }] = useRemoteBasePluginQuery({
    variables: { orgSlug: orgSlug ?? "", projectSlug: projectSlug ?? "" },
    pause: !orgSlug || !projectSlug,
  });
  const session = data?.currentScreenGuestSession ?? null;
  const screen = session?.screen ?? null;

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
    window.location.replace(
      `/o/${screen.organization.slug}/screens/${screen.slug}/ended`,
    );
  }, [revoked, screen]);

  return <>{children}</>;
}
