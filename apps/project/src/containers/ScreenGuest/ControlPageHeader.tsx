import { useLogoutScreenGuestSessionMutation } from "@repo/graphql";
import { Badge, Button } from "@repo/ui";
import { useCallback } from "react";
import { toast } from "react-toastify";

export const ControlPageHeader = ({
  screenName,
  isMember,
  guestSignedIn,
  onSignedOut,
}: {
  screenName: string;
  isMember: boolean;
  guestSignedIn: boolean;
  onSignedOut?: () => void;
}) => {
  const [{ fetching: loggingOut }, logoutGuest] =
    useLogoutScreenGuestSessionMutation();

  const handleSignOut = useCallback(async () => {
    const res = await logoutGuest({});
    if (res.error) {
      toast.error("Sign out failed: " + res.error.message);
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
        {!isMember && guestSignedIn && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={handleSignOut}
            isLoading={loggingOut}
          >
            Sign out
          </Button>
        )}
      </div>
    </div>
  );
};
