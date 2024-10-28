import { ApolloError, QueryResult } from "@apollo/client";
import { Button, HStack, Link } from "@chakra-ui/react";
import {
  SharedLayout_QueryFragment,
  SharedLayout_UserFragment,
  useCurrentUserUpdatedSubscription,
} from "@repo/graphql";
import { ErrorAlert } from "@repo/ui";
import NextLink from "next/link";
import { useRouter } from "next/router";
import * as React from "react";

import { Redirect } from "./Redirect";
import { SharedLayoutSkeleton } from "./SharedLayoutSkeleton";
import { StandardWidth } from "./StandardWidth";

export interface SharedLayoutChildProps {
  error?: ApolloError | Error;
  loading: boolean;
  currentUser?: SharedLayout_UserFragment | null;
}

export enum AuthRestrict {
  NEVER = 0,
  LOGGED_OUT = 1 << 0,
  LOGGED_IN = 1 << 1,
  NOT_ADMIN = 1 << 2,
}

export interface SharedLayoutProps {
  /*
   * We're expecting lots of different queries to be passed through here, and
   * for them to have this common required data we need. Methods like
   * `subscribeToMore` are too specific (and we don't need them) so we're going
   * to drop them from the data requirements.
   *
   * NOTE: we're not fetching this query internally because we want the entire
   * page to be fetchable via a single GraphQL query, rather than multiple
   * chained queries.
   */
  query: Pick<
    QueryResult<SharedLayout_QueryFragment>,
    "data" | "loading" | "error" | "networkStatus" | "client" | "refetch"
  >;

  title?: string;
  overrideTitle?: string;
  children:
    | React.ReactNode
    | ((props: SharedLayoutChildProps) => React.ReactNode);
  noPad?: boolean;
  noFooter?: boolean;
  noHandleErrors?: boolean;
  forbidWhen?: AuthRestrict;
}

/* The Apollo `useSubscription` hook doesn't currently allow skipping the
 * subscription; we only want it when the user is logged in, so we conditionally
 * call this stub component.
 */
function CurrentUserUpdatedSubscription() {
  /*
   * This will set up a GraphQL subscription monitoring for changes to the
   * current user. Interestingly we don't need to actually _do_ anything - no
   * rendering or similar - because the payload of this mutation will
   * automatically update Apollo's cache which will cause the data to be
   * re-rendered wherever appropriate.
   */
  useCurrentUserUpdatedSubscription();
  return null;
}

export function SharedLayout({
  title,
  overrideTitle,
  noPad = false,
  noFooter = false,
  noHandleErrors = false,
  query,
  forbidWhen = AuthRestrict.NEVER,
  children,
}: SharedLayoutProps) {
  const router = useRouter();

  const forbidsLoggedIn = forbidWhen & AuthRestrict.LOGGED_IN;
  const forbidsLoggedOut = forbidWhen & AuthRestrict.LOGGED_OUT;
  const forbidsNotAdmin = forbidWhen & AuthRestrict.NOT_ADMIN;
  const renderChildren = (props: SharedLayoutChildProps) => {
    const inner =
      props.error && !props.loading && !noHandleErrors ? (
        <>
          {process.env.NODE_ENV === "development" ? (
            <ErrorAlert error={props.error} />
          ) : null}
        </>
      ) : typeof children === "function" ? (
        children(props)
      ) : (
        children
      );
    if (
      data &&
      data.currentUser &&
      (forbidsLoggedIn || (forbidsNotAdmin && !data.currentUser.isAdmin))
    ) {
      return (
        <StandardWidth>
          <Redirect href={"/o"} />
        </StandardWidth>
      );
    } else if (
      data &&
      data.currentUser === null &&
      !loading &&
      !error &&
      forbidsLoggedOut
    ) {
      return (
        <Redirect href={`/login?next=${encodeURIComponent(router.asPath)}`} />
      );
    }

    return noPad ? inner : <StandardWidth>{inner}</StandardWidth>;
  };
  const { data, loading, error } = query;

  return (
    <>
      {data && data.currentUser ? <CurrentUserUpdatedSubscription /> : null}
      <SharedLayoutSkeleton
        title={title}
        overrideTitle={overrideTitle}
        noFooter={noFooter}
        navbarRight={
          <HStack wrap="wrap">
            <HStack gap={6}>
              <Link as={NextLink} href={`/login`} variant="linkButton">
                <Button size="sm" variant="link" data-cy="header-login-button">
                  Sign in
                </Button>
              </Link>
              <Link as={NextLink} href={`/register`} variant="button">
                <Button
                  size="sm"
                  colorScheme="green"
                  data-cy="header-register-button"
                >
                  Sign up for free
                </Button>
              </Link>
            </HStack>
          </HStack>
        }
      >
        {renderChildren({
          error,
          loading,
          currentUser: data && data.currentUser,
        })}
      </SharedLayoutSkeleton>
    </>
  );
}
