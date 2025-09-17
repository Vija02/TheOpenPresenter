import {
  TagFragment,
  useAllTagByOrganizationQuery
} from "@repo/graphql";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { UseQueryExecute } from "urql";

import { useSubscribeAPIChanges } from "./pubsub";

type TagProviderPropTypes = {
  slug: string;
};

type TagProviderType = {
  loadAllTagByOrganization: (() => void) | null;
  allTagByOrganizationQueryResult:
    | ReturnType<typeof useAllTagByOrganizationQuery>[0]
    | null;
  allTagByOrganization: TagFragment[] | undefined;
  refetch: UseQueryExecute | null;
};

const initialData: TagProviderType = {
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

  const [allTagByOrganizationQueryResult, refetch] =
    useAllTagByOrganizationQuery({
      variables: { slug, search: "" },
      pause: skip,
    });

  const allTagByOrganization = useMemo(
    () => allTagByOrganizationQueryResult.data?.organizationBySlug?.tags?.nodes,
    [allTagByOrganizationQueryResult.data?.organizationBySlug?.tags?.nodes],
  );

  useSubscribeAPIChanges({
    token: "tag",
    handler: () => {
      if (allTagByOrganizationQueryResult.data) {
        refetch();
      }
    },
  });

  return (
    <TagContext.Provider
      value={{
        loadAllTagByOrganization,
        allTagByOrganizationQueryResult,
        allTagByOrganization,
        refetch,
      }}
    >
      {children}
    </TagContext.Provider>
  );
};
