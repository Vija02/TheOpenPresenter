import { Redirect } from "@/components/Redirect";
import { AuthRestrict, SharedLayout } from "@/components/SharedLayout";
import { QueryResult } from "@apollo/client";
import {
  InvitationDetailQuery,
  InvitationDetailQueryVariables,
  SharedLayout_UserFragment,
  useAcceptOrganizationInviteMutation,
  useInvitationDetailQuery,
} from "@repo/graphql";
import { getCodeFromError } from "@repo/lib";
import {
  Button,
  ErrorAlert,
  FourOhFour,
  Link,
  LoadingPart,
  Skeleton,
} from "@repo/ui";
import React, { FC } from "react";
import { Link as WouterLink } from "wouter";
import { useLocation, useSearch, useSearchParams } from "wouter";

enum Status {
  PENDING = "PENDING",
  ACCEPTING = "ACCEPTING",
}

const InvitationAccept = () => {
  const [searchParams] = useSearchParams();
  const [location] = useLocation();
  const searchString = useSearch();
  const rawId = searchParams.get("id");
  const rawCode = searchParams.get("code");

  const fullHref = location + (searchString ? `?${searchString}` : "");

  const id = rawId?.toString() ?? "";
  const code = rawCode?.toString() ?? "";
  const query = useInvitationDetailQuery({
    variables: {
      id,
      code: code,
    },
    skip: !id,
    fetchPolicy: "network-only",
  });

  if (!id) {
    throw new Error("id not supplied");
  }

  return (
    <SharedLayout
      title="Accept Invitation"
      query={query}
      noHandleErrors
      forbidWhen={AuthRestrict.LOGGED_OUT}
    >
      {({ currentUser, error, loading }) =>
        !currentUser && !error && !loading ? (
          <Redirect href={`/login?next=${encodeURIComponent(fullHref)}`} />
        ) : (
          <InvitationAcceptInner
            currentUser={currentUser}
            id={id}
            code={code}
            query={query}
          />
        )
      }
    </SharedLayout>
  );
};

interface InvitationAcceptInnerProps {
  currentUser?: SharedLayout_UserFragment | null;
  query: QueryResult<InvitationDetailQuery, InvitationDetailQueryVariables>;
  id: string;
  code: string;
}

const InvitationAcceptInner: FC<InvitationAcceptInnerProps> = (props) => {
  const { id, code, query } = props;
  const [location, navigate] = useLocation();

  const { data, loading, error } = query;
  const [acceptInvite] = useAcceptOrganizationInviteMutation();

  const [status, setStatus] = React.useState(Status.PENDING);
  const [acceptError, setAcceptError] = React.useState<Error | null>(null);

  const organization = data?.organizationForInvitation;
  const handleAccept = React.useCallback(() => {
    if (!organization) {
      return;
    }
    setStatus(Status.ACCEPTING);
    // Call mutation
    acceptInvite({
      variables: {
        id,
        code,
      },
    }).then(
      () => {
        // Redirect
        navigate(`/o/${organization.slug}`);
      },
      (e) => {
        setStatus(Status.PENDING);
        setAcceptError(e);
      },
    );
  }, [acceptInvite, code, id, navigate, organization]);

  let child: React.ReactNode | null = null;
  if (status === Status.ACCEPTING) {
    child = <LoadingPart />;
  } else if (error || acceptError) {
    const code = getCodeFromError(error || acceptError);
    if (code === "NTFND") {
      child = (
        <div className="stack-col items-start">
          <h2 className="text-2xl font-bold">
            That invitation could not be found
          </h2>
          <p>Perhaps you have already accepted it?</p>
        </div>
      );
    } else if (code === "DNIED") {
      child = (
        <div className="stack-col items-start">
          <h2 className="text-2xl font-bold">That invitation is not for you</h2>
          <p>Perhaps you should log out and log in with a different account?</p>
        </div>
      );
    } else if (code === "LOGIN") {
      child = (
        <div className="stack-col items-start">
          <h2 className="text-2xl font-bold">Log in to accept invitation</h2>
          <div>
            <Link asChild>
              <WouterLink href={`/login?next=${encodeURIComponent(location)}`}>
                <Button>Log in</Button>
              </WouterLink>
            </Link>
          </div>
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
