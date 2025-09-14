import { Exact, SharedQuery, SharedQueryVariables } from "@repo/graphql";
import { globalState } from "@repo/lib";
import { UseQueryResponse } from "urql";

// Try our best to find out the last organization that the user selected.
// We do this through a persisted atom that is updated every time we access an organization
// Otherwise, we get the first organization on the list
// However, there is always a possibility that the user does not have an organization
export const useInferLastSelectedOrganization = ([{ data }]: UseQueryResponse<
  SharedQuery,
  Exact<SharedQueryVariables>
>) => {
  if (typeof window === "undefined") {
    throw new Error(
      "This hook should not be called on SSR. It should be wrapped inside a <ClientOnly> component",
    );
  }

  const lastSelectedOrganizationId =
    globalState.organization.useLastSelectedOrganizationId(
      (x) => x.lastSelectedOrganizationId,
    );

  if (lastSelectedOrganizationId) {
    const membership = data?.currentUser?.organizationMemberships.nodes.find(
      (membership) =>
        membership.organization?.id === lastSelectedOrganizationId,
    );
    if (membership) {
      return membership.organization;
    }
  }

  if ((data?.currentUser?.organizationMemberships.nodes ?? []).length > 0) {
    return data?.currentUser?.organizationMemberships.nodes[0]?.organization;
  }

  return null;
};
