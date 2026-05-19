import { useLogoutScreenGuestSessionMutation } from "@repo/graphql";
import { Badge, Button, Link } from "@repo/ui";
import { useCallback } from "react";
import { VscSettingsGear } from "react-icons/vsc";
import { toast } from "react-toastify";
import { Link as WouterLink } from "wouter";

export const ControlPageHeader = ({
  screenName,
  isMember,
  guestSignedIn,
  onSignedOut,
  adminHref,
}: {
  screenName: string;
  isMember: boolean;
  guestSignedIn: boolean;
  onSignedOut?: () => void;
  adminHref?: string;
}) => {
  const [{ fetching: loggingOut }, logoutGuest] =
    useLogoutScreenGuestSessionMutation();

  const handleSignOut = useCallback(async () => {
    try {
      await logoutGuest({});
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Failed to end session: " + msg);
      return;
    }
    onSignedOut?.();
    window.location.reload();
  }, [logoutGuest, onSignedOut]);

  return (
    <div className="mb-4">
      <p className="text-sm text-tertiary uppercase tracking-wide">
        Screen control
      </p>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">{screenName}</h1>
        {!isMember && (
          <Badge variant="default" size="sm">
            Guest
          </Badge>
        )}
        {isMember && adminHref && (
          <Link asChild variant="unstyled" className="ml-auto">
            <WouterLink href={adminHref}>
              <Button size="sm" variant="outline">
                <VscSettingsGear />
                Admin panel
              </Button>
            </WouterLink>
          </Link>
        )}
        {!isMember && guestSignedIn && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={handleSignOut}
            isLoading={loggingOut}
          >
            End session
          </Button>
        )}
      </div>
    </div>
  );
};
