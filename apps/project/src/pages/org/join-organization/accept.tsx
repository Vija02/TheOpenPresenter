import { SharedLayoutLoggedIn } from "@/components/SharedLayoutLoggedIn";
import {
  JoinRequestDetailQuery,
  JoinRequestDetailQueryVariables,
  SharedLayout_UserFragment,
  useAcceptJoinRequestToOrganizationMutation,
  useJoinRequestDetailQuery,
} from "@repo/graphql";
import { Button, ErrorAlert, LoadingPart, Skeleton } from "@repo/ui";
import React, { FC } from "react";
import { UseQueryResponse } from "urql";
import { useSearchParams } from "wouter";

enum Status {
  PENDING = "PENDING",
  ACCEPTING = "ACCEPTING",
  DONE = "DONE",
}

const JoinRequestAccept = () => {
  const [searchParams] = useSearchParams();
  const rawId = searchParams.get("id");

  const id = rawId?.toString() ?? "";
  const query = useJoinRequestDetailQuery({
    variables: {
      id,
    },
    pause: !id,
    requestPolicy: "network-only",
  });

  return (
    <SharedLayoutLoggedIn
      title="Accept Join Request"
      query={query}
      noHandleErrors
    >
      <JoinRequestAcceptInner
        currentUser={query[0].data?.currentUser}
        id={id}
        query={query}
      />
    </SharedLayoutLoggedIn>
  );
};

interface JoinRequestAcceptInnerProps {
  currentUser?: SharedLayout_UserFragment | null;
  query: UseQueryResponse<
    JoinRequestDetailQuery,
    JoinRequestDetailQueryVariables
  >;
  id: string;
}

const JoinRequestAcceptInner: FC<JoinRequestAcceptInnerProps> = (props) => {
  const { id, query } = props;

  const { data, fetching: loading, error } = query[0];
  const [, acceptJoinRequest] = useAcceptJoinRequestToOrganizationMutation();

  const [status, setStatus] = React.useState(Status.PENDING);
  const [acceptError, setAcceptError] = React.useState<Error | null>(null);

  const user = data?.organizationJoinRequest?.user;
  const organization = data?.organizationJoinRequest?.organization;
  const handleAccept = React.useCallback(() => {
    if (!user) {
      return;
    }
    setStatus(Status.ACCEPTING);
    // Call mutation
    acceptJoinRequest({
      id,
    }).then(
      () => {
        setStatus(Status.DONE);
      },
      (e) => {
        setStatus(Status.PENDING);
        setAcceptError(e);
      },
    );
  }, [acceptJoinRequest, id, user]);

  let child: React.ReactNode | null = null;
  if (status === Status.ACCEPTING) {
    child = <LoadingPart />;
  } else if (status === Status.DONE) {
    child = (
      <div className="stack-col items-start">
        <p className="text-2xl font-bold">
          {user?.name} is now a member of {organization?.name}
        </p>
        <p>We will send them an email to notify them of this change.</p>
      </div>
    );
  } else if (error || acceptError) {
    child = <ErrorAlert error={error || acceptError!} />;
  } else if (user) {
    child = (
      <div className="stack-col items-start">
        <p className="text-2xl font-bold">Accept join request by {user.name}</p>
        <p>
          By accepting this request, you will be granting full access of your
          organization <b>'{organization?.name}'</b> to the user{" "}
          <b>'{user.name}'</b>
        </p>
        <p>
          They will be able to modify all and create any projects in{" "}
          {organization?.name}. You will always be able to change this in the
          settings page.
        </p>
        <Button onClick={handleAccept} variant="success">
          Accept request
        </Button>
      </div>
    );
  } else if (loading) {
    child = <Skeleton />;
  } else {
    child = (
      <div className="stack-col items-start">
        <p className="text-2xl font-bold">Something went wrong</p>
        <p>
          We couldn't find details about this invite, please try again later
        </p>
      </div>
    );
  }
  return child;
};

export default JoinRequestAccept;
