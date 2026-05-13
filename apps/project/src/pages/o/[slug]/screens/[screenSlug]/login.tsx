import { AuthRestrict, SharedLayout } from "@/components/SharedLayout";
import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import {
  useAuthenticateScreenGuestMutation,
  useCreateAnonScreenGuestSessionMutation,
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
import { CombinedError } from "urql";
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
  const currentSession = data?.currentScreenGuestSession ?? null;

  const sessionMatchesThisScreen =
    !!currentSession &&
    !!meta?.screenId &&
    currentSession.screenId === meta.screenId;
  const isMember = useMemo(() => {
    if (!organizationId) return false;
    const memberships = data?.currentUser?.organizationMemberships?.nodes ?? [];
    return memberships.some((m) => m.organization?.id === organizationId);
  }, [organizationId, data?.currentUser]);

  const memberHref = `/o/${orgSlug}/screens/${screenSlug}/control`;
  const requestHref = `/o/${orgSlug}/screens/${screenSlug}/request`;
  const loginHref = `/o/${orgSlug}/screens/${screenSlug}/login`;

  const shouldRedirect =
    sessionMatchesThisScreen || (!!currentUserId && isMember);
  const redirectHref = !!currentUserId && isMember ? memberHref : requestHref;

  const wrongAccount = !!currentUserId && !!organizationId && !isMember;

  if (fetching) {
    return <LoadingFull />;
  }

  if (shouldRedirect) {
    return <Redirect href={redirectHref} replace external />;
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
        {organizationId && meta?.screenId && (
          <GuestLoginForm
            screenId={meta.screenId}
            allowsAnon={meta?.allowsAnon ?? false}
            allowsRegistered={meta?.allowsRegistered ?? false}
            onLoggedIn={() => setLocation(requestHref, { replace: true })}
          />
        )}
        {wrongAccount && (
          <p className="mt-3 text-xs text-secondary text-center">
            Admin of {orgName ?? "this organization"}?{" "}
            <Link
              href={`/logout?next=${encodeURIComponent(loginHref)}`}
              className="underline"
            >
              Switch accounts
            </Link>
            .
          </p>
        )}
        {!currentUserId && (
          <p className="mt-3 text-xs text-secondary text-center">
            Admin of {orgName ?? "this organization"}?{" "}
            <Link
              href={`/login?next=${encodeURIComponent(loginHref)}`}
              className="underline"
            >
              Sign in
            </Link>
            .
          </p>
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
        await authPasscode({
          screenId,
          passcode: passcode.trim(),
        });
      } else {
        await createGuest({
          screenId,
          displayName: displayName.trim() || undefined,
        });
      }
      onLoggedIn();
    } catch (e: any) {
      const err = e as CombinedError;
      const fallback =
        mode === "passcode"
          ? "Incorrect email or passcode."
          : "Couldn't start a guest session.";
      setError(
        err.graphQLErrors?.[0]?.message ?? err.message ?? fallback,
      );
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
          ? "Continue as a guest, or sign in with passcode."
          : allowsAnon
            ? "Continue as a guest to control this screen."
            : "Sign in with passcode."}
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

export default OrganizationSlugScreenLoginPage;
