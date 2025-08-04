import { ApolloError, QueryResult } from "@apollo/client";
import {
  SharedLayout_QueryFragment,
  SharedLayout_UserFragment,
  useCurrentUserUpdatedSubscription,
} from "@repo/graphql";
import { Button, ErrorAlert, Link } from "@repo/ui";
import * as React from "react";
import { Link as WouterLink, useLocation } from "wouter";

import { Redirect } from "./Redirect";
import {
  SharedLayoutSkeleton,
  SharedLayoutSkeletonProps,
} from "./SharedLayoutSkeleton";
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
  navbarLeft?: SharedLayoutSkeletonProps["navbarLeft"];
  navbarRight?: SharedLayoutSkeletonProps["navbarRight"];
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
  navbarLeft,
  navbarRight,
  query,
  forbidWhen = AuthRestrict.NEVER,
  children,
}: SharedLayoutProps) {
  const [location] = useLocation();

  const forbidsLoggedIn = forbidWhen & AuthRestrict.LOGGED_IN;
  const forbidsLoggedOut = forbidWhen & AuthRestrict.LOGGED_OUT;
  const forbidsNotAdmin = forbidWhen & AuthRestrict.NOT_ADMIN;
  const renderChildren = (props: SharedLayoutChildProps) => {
    const inner =
      props.error && !props.loading && !noHandleErrors ? (
        <>{import.meta.env.DEV ? <ErrorAlert error={props.error} /> : null}</>
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
      return <Redirect href={`/login?next=${encodeURIComponent(location)}`} />;
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
        navbarLeft={navbarLeft}
        navbarRight={
          navbarRight ?? (
            <div className="flex flex-wrap gap-6">
              <div className="stack-row items-center gap-6">
                <Link asChild>
                  <WouterLink href="/login">
                    <Button
                      size="sm"
                      variant="link"
                      className="text-gray-500"
                      data-cy="header-login-button"
                    >
                      Sign in
                    </Button>
                  </WouterLink>
                </Link>
                <Link asChild>
                  <WouterLink href="/register">
                    <Button
                      size="sm"
                      variant="success"
                      data-cy="header-register-button"
                    >
                      Sign up for free
                    </Button>
                  </WouterLink>
                </Link>
              </div>
            </div>
          )
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
