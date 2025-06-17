import { QueryResult } from "@apollo/client";
import { Box } from "@chakra-ui/react";
import { SharedOrganizationFragment } from "@repo/graphql";
import { ErrorAlert, FourOhFour, LoadingPart } from "@repo/ui";
import { useRouter } from "next/router";
import React from "react";

export function useOrganizationSlug() {
  const router = useRouter();
  const { slug: rawSlug } = router.query;
  return String(rawSlug);
}

export function useOrganizationLoading(
  query: Pick<
    QueryResult<SharedOrganizationFragment>,
    "data" | "loading" | "error" | "networkStatus" | "client" | "refetch"
  >,
) {
  const { data, loading, error } = query;

  let child: React.ReactNode | null = null;
  const organization = data?.organizationBySlug;
  if (organization) {
    return null;
  } else if (loading && !data) {
    child = <LoadingPart />;
  } else if (error) {
    child = <ErrorAlert error={error} />;
  } else {
    child = <FourOhFour loggedIn={!!data?.currentUser} />;
  }

  return child ? <Box>{child}</Box> : null;
}
