import { ApolloQueryResult, useApolloClient } from "@apollo/client";
import {
  AllTagByOrganizationDocument,
  AllTagByOrganizationQuery,
  AllTagByOrganizationQueryVariables,
  TagFragment,
  useAllTagByOrganizationQuery,
} from "@repo/graphql";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useSubscribeAPIChanges } from "./pubsub";

type TagProviderPropTypes = {
  slug: string;
};

type TagProviderType = {
  searchAllTagByOrganization:
    | ((search: string) => Promise<ApolloQueryResult<TagFragment[]>>)
    | null;
  loadAllTagByOrganization: (() => void) | null;
  allTagByOrganizationQueryResult: ReturnType<
    typeof useAllTagByOrganizationQuery
  > | null;
  allTagByOrganization: TagFragment[] | undefined;
  refetch: ReturnType<typeof useAllTagByOrganizationQuery>["refetch"] | null;
};

const initialData: TagProviderType = {
  searchAllTagByOrganization: null,
  loadAllTagByOrganization: null,
  allTagByOrganizationQueryResult: null,
  allTagByOrganization: undefined,
  refetch: null,
};

export const TagContext = createContext<TagProviderType>(initialData);

export const useTag = () => {
  const context = useContext(TagContext);

  // This is here since we only want to load the data once it is needed
  useEffect(() => {
    context.loadAllTagByOrganization?.();
  }, [context]);

  return context;
};

export const TagConsumer = TagContext.Consumer;

export const TagProvider = ({
  children,
  slug,
}: React.PropsWithChildren<TagProviderPropTypes>) => {
  const [skip, setSkip] = useState(true);
  const loadAllTagByOrganization = useCallback(() => {
    setSkip(false);
  }, []);

  const allTagByOrganizationQueryResult = useAllTagByOrganizationQuery({
    variables: { slug, search: "" },
    skip,
  });

  const client = useApolloClient();
  const searchAllTagByOrganization = useCallback(
    (search: string) =>
      client
        .query<AllTagByOrganizationQuery, AllTagByOrganizationQueryVariables>({
          query: AllTagByOrganizationDocument,
          variables: { slug, search },
        })
        .then(
          (res) =>
            ({
              ...res,
              data: res.data.organizationBySlug?.tags.nodes,
            }) as ApolloQueryResult<TagFragment[]>,
        ),
    [client, slug],
  );

  const allTagByOrganization = useMemo(
    () => allTagByOrganizationQueryResult.data?.organizationBySlug?.tags?.nodes,
    [allTagByOrganizationQueryResult.data?.organizationBySlug?.tags?.nodes],
  );

  useSubscribeAPIChanges({
    token: "tag",
    handler: () => {
      if (allTagByOrganizationQueryResult.called) {
        allTagByOrganizationQueryResult.refetch();
      }
    },
  });

  return (
    <TagContext.Provider
      value={{
        searchAllTagByOrganization,
        loadAllTagByOrganization,
        allTagByOrganizationQueryResult,
        allTagByOrganization,
        refetch: allTagByOrganizationQueryResult.refetch,
      }}
    >
      {children}
    </TagContext.Provider>
  );
};
