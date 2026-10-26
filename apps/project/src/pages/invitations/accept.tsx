import { SharedLayout } from "@/components/SharedLayout";
import { SocialLoginOptions } from "@/components/SocialLoginOptions";
import {
  InvitationPreviewQuery,
  SharedLayout_UserFragment,
  useAcceptOrganizationInviteMutation,
  useInvitationDetailQuery,
  useInvitationPreviewQuery,
} from "@repo/graphql";
import { getCodeFromError } from "@repo/lib";
import { Button, ErrorAlert, Link, LoadingPart, Skeleton } from "@repo/ui";
import React, { FC } from "react";
import { Link as WouterLink, useLocation, useSearchParams } from "wouter";

enum Status {
  PENDING = "PENDING",
  ACCEPTING = "ACCEPTING",
}

type InvitationPreview = NonNullable<
  InvitationPreviewQuery["invitationPreview"]
>;

const GOOGLE_EMAIL_DOMAINS = ["gmail.com", "googlemail.com"];

const isGoogleEmail = (email: string | null | undefined) =>
  !!email &&
  GOOGLE_EMAIL_DOMAINS.includes(email.split("@").pop()?.toLowerCase() ?? "");

const InvitationAccept = () => {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const code = searchParams.get("code") ?? "";
  const auto = searchParams.has("auto");

  const query = useInvitationPreviewQuery({
    variables: { id, code },
    pause: !id,
  });

  const invitationHref =
    `/invitations/accept?id=${encodeURIComponent(id)}` +
    (code ? `&code=${encodeURIComponent(code)}` : "");

  return (
    <SharedLayout title="Accept Invitation" query={query} noHandleErrors>
      {({ currentUser, loading }) => {
        const preview = query[0].data?.invitationPreview;
        if (!id) {
          return <InvalidInvitation />;
        }
        if (loading) {
          return <Skeleton />;
        }
        if (currentUser) {
          return (
            <InvitationAcceptInner
              currentUser={currentUser}
              id={id}
              code={code}
              auto={auto}
              preview={preview}
              invitationHref={invitationHref}
            />
          );
        }
        if (!preview) {
          return <InvalidInvitation />;
        }
        return (
          <InvitationSignIn
            preview={preview}
            next={`${invitationHref}&auto=1`}
          />
        );
      }}
    </SharedLayout>
  );
};

const InvalidInvitation = () => (
  <div className="stack-col items-start">
    <h2 className="text-2xl font-bold">That invitation could not be found</h2>
    <p>
      The link may be incomplete, or the invitation has already been accepted.
    </p>
  </div>
);

const InvitationSignIn: FC<{ preview: InvitationPreview; next: string }> = ({
  preview,
  next,
}) => {
  const email = preview.email ?? undefined;
  const emailParam = email ? `&email=${encodeURIComponent(email)}` : "";
  const loginHref = `/login?next=${encodeURIComponent(next)}${emailParam}`;
  const registerHref = `/register?next=${encodeURIComponent(next)}${emailParam}`;
  const preferLogin = preview.hasAccount !== false;

  return (
    <div className="flex justify-center px-4 py-12">
      <div className="max-w-sm w-full stack-col items-start gap-4">
        <div className="stack-col items-start gap-1 w-full">
          <h1 className="text-2xl font-bold">
            Join {preview.organizationName}
          </h1>
          <p className="text-secondary">
            {email ? (
              <>
                This invitation was sent to <strong>{email}</strong>.{" "}
              </>
            ) : null}
            {preferLogin
              ? "Sign in to accept it."
              : "Create your account to accept it."}
          </p>
        </div>

        <SocialLoginOptions
          next={next}
          persistSession
          showQRLogin={false}
          loginHint={email}
          services={isGoogleEmail(email) ? ["google"] : undefined}
          buttonTextFromService={
            isGoogleEmail(email)
              ? (label) => `Continue with ${label}`
              : undefined
          }
        />
        <Button
          asChild
          variant="outline"
          size="lg"
          className="w-full hover:no-underline"
          data-testid="invitation-email"
        >
          <WouterLink href={preferLogin ? loginHref : registerHref}>
            Continue with email &amp; password
          </WouterLink>
        </Button>
        <div className="stack-col items-center w-full">
          <Link asChild>
            <WouterLink
              href={preferLogin ? registerHref : loginHref}
              className="text-sm"
            >
              {preferLogin
                ? "Don't have an account yet? Sign up"
                : "Already have an account? Sign in"}
            </WouterLink>
          </Link>
        </div>
      </div>
    </div>
  );
};

interface InvitationAcceptInnerProps {
  currentUser: SharedLayout_UserFragment;
  id: string;
  code: string;
  auto: boolean;
  preview: InvitationPreview | null | undefined;
  invitationHref: string;
}

const InvitationAcceptInner: FC<InvitationAcceptInnerProps> = (props) => {
  const { id, code, auto, preview, invitationHref } = props;
  const [, navigate] = useLocation();

  const [{ data, fetching: loading, error }] = useInvitationDetailQuery({
    variables: { id, code },
    requestPolicy: "network-only",
  });
  const [, acceptInvite] = useAcceptOrganizationInviteMutation();

  const [status, setStatus] = React.useState(Status.PENDING);
  const [acceptError, setAcceptError] = React.useState<Error | null>(null);
  const autoAcceptAttempted = React.useRef(false);

  const organization = data?.organizationForInvitation;
  const handleAccept = React.useCallback(() => {
    if (!organization) {
      return;
    }
    setStatus(Status.ACCEPTING);
    acceptInvite({ id, code }).then(
      () => {
        navigate(`/o/${organization.slug}`, { replace: true });
      },
      (e) => {
        setStatus(Status.PENDING);
        setAcceptError(e);
      },
    );
  }, [acceptInvite, code, id, navigate, organization]);

  React.useEffect(() => {
    if (auto && organization && !autoAcceptAttempted.current) {
      autoAcceptAttempted.current = true;
      handleAccept();
    }
  }, [auto, organization, handleAccept]);

  let child: React.ReactNode | null = null;
  if (status === Status.ACCEPTING || (auto && organization && !acceptError)) {
    child = <LoadingPart />;
  } else if (error || acceptError) {
    const errorCode = getCodeFromError(error || acceptError);
    if (errorCode === "NTFND") {
      child = <InvalidInvitation />;
    } else if (errorCode === "DNIED") {
      child = (
        <div className="stack-col items-start">
          <h2 className="text-2xl font-bold">
            This invitation is for a different account
          </h2>
          <p>
            {preview?.email ? (
              <>
                It was sent to <strong>{preview.email}</strong>.{" "}
              </>
            ) : null}
            Sign out and continue with the right account to accept it.
          </p>
          <Button asChild variant="success">
            <a
              href={`/logout?next=${encodeURIComponent(invitationHref)}`}
              className="hover:no-underline"
            >
              Sign out and continue
            </a>
          </Button>
        </div>
      );
    } else {
      child = <ErrorAlert error={error || acceptError!} />;
    }
  } else if (organization) {
    child = (
      <div className="stack-col items-start">
        <h2 className="text-2xl font-bold">
          You were invited to {organization.name}
        </h2>
        <Button onClick={handleAccept} variant="success">
          Accept invitation
        </Button>
      </div>
    );
  } else if (loading) {
    child = <Skeleton />;
  } else {
    child = (
      <div className="stack-col items-start">
        <h2 className="text-2xl font-bold">Something went wrong</h2>
        <p>
          We couldn't find details about this invite, please try again later
        </p>
      </div>
    );
  }
  return child;
};

export default InvitationAccept;
