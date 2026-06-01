import { OrganizationType, SharedOrganizationFragment } from "@repo/graphql";
import { ErrorAlert, FourOhFour, LoadingFull } from "@repo/ui";
import React from "react";
import { UseQueryResponse } from "urql";
import { useParams } from "wouter";

export function useOrganizationSlug() {
  const { slug: rawSlug } = useParams();
  return String(rawSlug);
}

export type OrganizationContextValue = {
  organizationType: OrganizationType | null;
};

const OrganizationContext = React.createContext<OrganizationContextValue>({
  organizationType: null,
});

export const OrganizationProvider = OrganizationContext.Provider;

export function useOrganizationType(): OrganizationType | null {
  return React.useContext(OrganizationContext).organizationType;
}

export function useOrganizationLoading(
  query: UseQueryResponse<SharedOrganizationFragment>,
) {
  const [{ data, fetching: loading, error }] = query;

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

  return child ? <div>{child}</div> : null;
}
