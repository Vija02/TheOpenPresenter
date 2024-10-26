import { Redirect } from "@/components/Redirect";
import { AuthRestrict, SharedLayout } from "@/components/SharedLayout";
import { QueryResult } from "@apollo/client";
import { Box, Button, Center, Skeleton, Text, VStack } from "@chakra-ui/react";
import {
  JoinRequestDetailQuery,
  JoinRequestDetailQueryVariables,
  SharedLayout_UserFragment,
  useAcceptJoinRequestToOrganizationMutation,
  useJoinRequestDetailQuery,
} from "@repo/graphql";
import { ErrorAlert, LoadingInline } from "@repo/ui";
import { NextPage } from "next";
import { useRouter } from "next/router";
import * as qs from "querystring";
import React, { FC } from "react";

enum Status {
  PENDING = "PENDING",
  ACCEPTING = "ACCEPTING",
  DONE = "DONE",
}

const JoinRequestAccept: NextPage = () => {
  const router = useRouter();
  const { id: rawId } = router.query;

  const fullHref =
    router.pathname +
    (router && router.query ? `?${qs.stringify(router.query)}` : "");

  const id = rawId?.toString() ?? "";
  const query = useJoinRequestDetailQuery({
    variables: {
      id,
    },
    skip: !id,
    fetchPolicy: "network-only",
  });

  return (
    <SharedLayout
      title="Accept Join Request"
      query={query}
      noHandleErrors
      forbidWhen={AuthRestrict.LOGGED_OUT}
    >
      {({ currentUser, error, loading }) =>
        !currentUser && !error && !loading ? (
          <Redirect href={`/login?next=${encodeURIComponent(fullHref)}`} />
        ) : (
          <Box>
            <JoinRequestAcceptInner
              currentUser={currentUser}
              id={id}
              query={query}
            />
          </Box>
        )
      }
    </SharedLayout>
  );
};

interface JoinRequestAcceptInnerProps {
  currentUser?: SharedLayout_UserFragment | null;
  query: QueryResult<JoinRequestDetailQuery, JoinRequestDetailQueryVariables>;
  id: string;
}

const JoinRequestAcceptInner: FC<JoinRequestAcceptInnerProps> = (props) => {
  const { id, query } = props;

  const { data, loading, error } = query;
  const [acceptJoinRequest] = useAcceptJoinRequestToOrganizationMutation();

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
      variables: {
        id,
      },
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

  let child: JSX.Element | null = null;
  if (status === Status.ACCEPTING) {
    child = <LoadingInline />;
  } else if (status === Status.DONE) {
    child = (
      <Center mt="10vh">
        <VStack>
          <Text fontSize="lg" fontWeight="bold">
            {user?.name} is now a member of {organization?.name}
          </Text>
          <Text>We will send them an email to notify them of this change.</Text>
        </VStack>
      </Center>
    );
  } else if (error || acceptError) {
    child = <ErrorAlert error={error || acceptError!} />;
  } else if (user) {
    child = (
      <Center mt="10vh">
        <VStack>
          <Text fontSize="lg" fontWeight="bold">
            Accept join request by {user.name}
          </Text>
          <Text>
            By accepting this request, you will be granting full access of your
            organization <b>'{organization?.name}'</b> to the user{" "}
            <b>'{user.name}'</b>
          </Text>
          <Text>
            They will be able to modify all and create any projects in{" "}
            {organization?.name}. You will always be able to change this in the
            settings page.
          </Text>
          <Button onClick={handleAccept} colorScheme="green">
            Accept request
          </Button>
        </VStack>
      </Center>
    );
  } else if (loading) {
    child = <Skeleton />;
  } else {
    child = (
      <Center mt="10vh">
        <VStack>
          <Text fontSize="lg" fontWeight="bold">
            Something went wrong
          </Text>
          <Text>
            We couldn't find details about this invite, please try again later
          </Text>
        </VStack>
      </Center>
    );
  }
  return child;
};

export default JoinRequestAccept;
