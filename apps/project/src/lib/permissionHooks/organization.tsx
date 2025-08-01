import { QueryResult } from "@apollo/client";
import { Box } from "@chakra-ui/react";
import { SharedOrganizationFragment } from "@repo/graphql";
import { ErrorAlert, FourOhFour, LoadingFull } from "@repo/ui";
import React from "react";
import { useParams } from "wouter";

export function useOrganizationSlug() {
  const { slug: rawSlug } = useParams();
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
    child = <LoadingFull />;
  } else if (error) {
    child = <ErrorAlert error={error} />;
  } else {
    child = <FourOhFour loggedIn={!!data?.currentUser} />;
  }

  return child ? <Box>{child}</Box> : null;
}
