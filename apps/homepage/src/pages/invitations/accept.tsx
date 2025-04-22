import { Redirect } from "@/components/Redirect";
import { AuthRestrict, SharedLayout } from "@/components/SharedLayout";
import { QueryResult } from "@apollo/client";
import {
  Box,
  Button,
  Center,
  Link,
  Skeleton,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  InvitationDetailQuery,
  InvitationDetailQueryVariables,
  SharedLayout_UserFragment,
  useAcceptOrganizationInviteMutation,
  useInvitationDetailQuery,
} from "@repo/graphql";
import { getCodeFromError } from "@repo/lib";
import { ErrorAlert, LoadingInline } from "@repo/ui";
import { NextPage } from "next";
import NextLink from "next/link";
import Router, { useRouter } from "next/router";
import * as qs from "querystring";
import React, { FC } from "react";

enum Status {
  PENDING = "PENDING",
  ACCEPTING = "ACCEPTING",
}

const InvitationAccept: NextPage = () => {
  const router = useRouter();
  const { id: rawId, code: rawCode } = router.query;

  const fullHref =
    router.pathname +
    (router && router.query ? `?${qs.stringify(router.query)}` : "");

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
          <Box>
            <InvitationAcceptInner
              currentUser={currentUser}
              id={id}
              code={code}
              query={query}
            />
          </Box>
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
  const router = useRouter();

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
        Router.push(`/o/[slug]`, `/o/${organization.slug}`);
      },
      (e) => {
        setStatus(Status.PENDING);
        setAcceptError(e);
      },
    );
  }, [acceptInvite, code, id, organization]);

  let child: React.ReactNode | null = null;
  if (status === Status.ACCEPTING) {
    child = <LoadingInline />;
  } else if (error || acceptError) {
    const code = getCodeFromError(error || acceptError);
    if (code === "NTFND") {
      child = (
        <Center mt="10vh">
          <VStack>
            <Text fontSize="lg" fontWeight="bold">
              That invitation could not be found
            </Text>
            <Text>Perhaps you have already accepted it?</Text>
          </VStack>
        </Center>
      );
    } else if (code === "DNIED") {
      child = (
        <Center mt="10vh">
          <VStack>
            <Text fontSize="lg" fontWeight="bold">
              That invitation is not for you
            </Text>
            <Text>
              Perhaps you should log out and log in with a different account?
            </Text>
          </VStack>
        </Center>
      );
    } else if (code === "LOGIN") {
      child = (
        <Center mt="10vh">
          <VStack>
            <Text fontSize="lg" fontWeight="bold">
              Log in to accept invitation
            </Text>
            <Text>
              <Link
                as={NextLink}
                href={`/login?next=${encodeURIComponent(router.asPath)}`}
              >
                <Button>Log in</Button>
              </Link>
            </Text>
          </VStack>
        </Center>
      );
    } else {
      child = <ErrorAlert error={error || acceptError!} />;
    }
  } else if (organization) {
    child = (
      <Center mt="10vh">
        <VStack>
          <Text fontSize="lg" fontWeight="bold">
            You were invited to {organization.name}
          </Text>
          <Button onClick={handleAccept} colorScheme="green">
            Accept invitation
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

export default InvitationAccept;
