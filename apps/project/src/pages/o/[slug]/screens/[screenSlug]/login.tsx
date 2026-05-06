import { AuthRestrict, SharedLayout } from "@/components/SharedLayout";
import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import {
  useAuthenticateScreenGuestMutation,
  useCreateAnonScreenGuestSessionMutation,
  useLogoutScreenGuestSessionMutation,
  useScreenLoginPageQuery,
} from "@repo/graphql";
import {
  Alert,
  Button,
  LoadingFull,
  Redirect,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@repo/ui";
import { useCallback, useMemo, useState } from "react";
import { VscPerson } from "react-icons/vsc";
import { Link, useLocation, useParams } from "wouter";

const OrganizationSlugScreenLoginPage = () => {
  const orgSlug = useOrganizationSlug();
  const params = useParams();
  const screenSlug = params.screenSlug!;
  const [, setLocation] = useLocation();

  const query = useScreenLoginPageQuery({
    variables: { orgSlug, screenSlug },
  });
  const [{ data, fetching }] = query;

  const meta = data?.screenLoginMetadata ?? null;
  const organizationId = meta?.organizationId ?? null;
  const orgName = meta?.organizationName ?? null;
  const currentUserId = data?.currentUser?.id ?? null;
  const currentScreenGuestSessionId = data?.currentScreenGuestSessionId ?? null;
  const isMember = useMemo(() => {
    if (!organizationId) return false;
    const memberships = data?.currentUser?.organizationMemberships?.nodes ?? [];
    return memberships.some((m) => m.organization?.id === organizationId);
  }, [organizationId, data?.currentUser]);

  const controlHref = `/o/${orgSlug}/screens/${screenSlug}/control`;
  const loginHref = `/o/${orgSlug}/screens/${screenSlug}/login`;

  const shouldRedirect =
    !!currentScreenGuestSessionId || (!!currentUserId && isMember);

  const wrongAccount = !!currentUserId && !!organizationId && !isMember;

  if (fetching) {
    return <LoadingFull />;
  }

  if (shouldRedirect) {
    return <Redirect href={controlHref} replace />;
  }

  // No guest access
  if (!fetching && data && !organizationId) {
    return (
      <SharedLayout
        title="Sign in"
        query={query}
        forbidWhen={AuthRestrict.NEVER}
      >
        <div className="max-w-md mx-auto p-4">
          <Alert variant="destructive" title="Screen not available">
            This screen either doesn't exist or isn't accessible without an
            admin account. If you have an account,{" "}
            <Link
              href={`/login?next=${encodeURIComponent(`/o/${orgSlug}/screens/${screenSlug}/admin`)}`}
              className="underline"
            >
              sign in
            </Link>
            .
          </Alert>
        </div>
      </SharedLayout>
    );
  }

  return (
    <SharedLayout title="Sign in" query={query} forbidWhen={AuthRestrict.NEVER}>
      <div className="max-w-md mx-auto p-4">
        <div className="mb-4">
          <p className="text-sm text-tertiary uppercase tracking-wide">
            Screen control
          </p>
          <h1 className="text-2xl font-bold">{orgName ?? "Sign in"}</h1>
        </div>
        {wrongAccount && (
          <Alert
            variant="destructive"
            title="You're signed in to a different account"
            className="mb-4"
          >
            Your current account isn't a member of this organization, so it
            can't control this screen.{" "}
            <Link
              href={`/logout?next=${encodeURIComponent(loginHref)}`}
              className="underline"
            >
              Sign out
            </Link>{" "}
            to use a different account, or continue as a guest below.
          </Alert>
        )}
        {organizationId && meta?.screenId && (
          <GuestLoginForm
            screenId={meta.screenId}
            allowsAnon={meta?.allowsAnon ?? false}
            allowsRegistered={meta?.allowsRegistered ?? false}
            onLoggedIn={() =>
              setLocation(`${controlHref}?autoClaim=1`, { replace: true })
            }
          />
        )}
        {currentScreenGuestSessionId && (
          <GuestSignOutFooter
            onSignedOut={() => {
              setLocation(`/o/${orgSlug}/screens/${screenSlug}/login`, {
                replace: true,
              });
            }}
          />
        )}
      </div>
    </SharedLayout>
  );
};

const GuestLoginForm = ({
  screenId,
  allowsAnon,
  allowsRegistered,
  onLoggedIn,
}: {
  screenId: string;
  allowsAnon: boolean;
  allowsRegistered: boolean;
  onLoggedIn: () => void;
}) => {
  const [, createGuest] = useCreateAnonScreenGuestSessionMutation();
  const [{ fetching: authFetching }, authPasscode] =
    useAuthenticateScreenGuestMutation();

  const [mode, setMode] = useState<"anon" | "passcode">(
    allowsAnon ? "anon" : "passcode",
  );
  const [displayName, setDisplayName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "passcode") {
        if (!passcode.trim()) {
          setError("Enter your email or passcode.");
          return;
        }
        const result = await authPasscode({
          screenId,
          passcode: passcode.trim(),
        });
        if (result.error) {
          setError(
            result.error.graphQLErrors?.[0]?.message ??
              "Incorrect email or passcode.",
          );
          return;
        }
      } else {
        const result = await createGuest({
          screenId,
          displayName: displayName.trim() || undefined,
        });
        if (result.error) {
          setError(
            result.error.graphQLErrors?.[0]?.message ??
              "Couldn't start a guest session.",
          );
          return;
        }
      }
      onLoggedIn();
    } catch (e: any) {
      setError(e.message ?? "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }, [
    mode,
    displayName,
    passcode,
    authPasscode,
    createGuest,
    screenId,
    onLoggedIn,
  ]);

  return (
    <div className="border border-stroke rounded p-4">
      <h2 className="text-lg font-semibold mb-1">
        Sign in to control a screen
      </h2>
      <p className="text-sm text-secondary mb-3">
        {allowsAnon && allowsRegistered
          ? "Continue as a guest, or sign in with the passcode an organization member gave you."
          : allowsAnon
            ? "Continue as a guest to control this screen."
            : "Sign in with the passcode an organization member gave you."}
      </p>

      {allowsAnon && allowsRegistered && (
        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v as "anon" | "passcode")}
          className="mb-3"
        >
          <TabsList>
            <TabsTrigger value="anon">Continue as guest</TabsTrigger>
            <TabsTrigger value="passcode">I have a passcode</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {error && (
        <Alert variant="destructive" title="Error" className="mb-3">
          {error}
        </Alert>
      )}

      {mode === "anon" ? (
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your name (optional)"
          className="border border-stroke rounded px-2 py-1 mb-3 w-full bg-background"
        />
      ) : (
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Email or passcode"
          autoComplete="current-password"
          className="border border-stroke rounded px-2 py-1 mb-3 w-full bg-background"
        />
      )}

      <Button
        variant="success"
        onClick={onSubmit}
        isLoading={submitting || authFetching}
      >
        <VscPerson />
        {mode === "passcode" ? "Sign in" : "Continue"}
      </Button>
    </div>
  );
};

const GuestSignOutFooter = ({ onSignedOut }: { onSignedOut: () => void }) => {
  const [{ fetching }, logoutGuest] = useLogoutScreenGuestSessionMutation();
  return (
    <div className="mt-4 text-center">
      <Button
        variant="ghost"
        size="sm"
        isLoading={fetching}
        onClick={async () => {
          const res = await logoutGuest({});
          if (!res.error) onSignedOut();
        }}
      >
        Sign out of guest session
      </Button>
    </div>
  );
};

export default OrganizationSlugScreenLoginPage;
