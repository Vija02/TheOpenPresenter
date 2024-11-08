import type {
  DocumentNode,
  OperationVariables,
  QueryHookOptions,
} from "@apollo/client";
import { useQuery as useQueryT } from "@apollo/client";
import { OperationDefinitionNode } from "graphql";
import { useMemo } from "react";
import { useSubscribe } from "use-pubsub-js";

export * from "@apollo/client/react";

// This makes all the "data" field not undefined when refetch
// https://github.com/apollographql/apollo-client/issues/7038#issuecomment-694853559
export function useQuery<TData, TVariables extends OperationVariables>(
  query: DocumentNode,
  options?: QueryHookOptions<TData, TVariables>,
) {
  const queryResult = useQueryT<TData, TVariables>(query, options);

  const isPage = useMemo(() => {
    const operationDefinition = query.definitions.find(
      (def) => def.kind === "OperationDefinition",
    ) as OperationDefinitionNode;

    if (!!operationDefinition) {
      return operationDefinition?.name?.value.endsWith("Page");
    }
    return false;
  }, [query]);

  // Automatically subscribe to "page" if the name of the query ends with "Page"
  // This is "magic" through name convention but will be very useful for us.
  useSubscribe({
    token: "page",
    handler: () => {
      queryResult.refetch();
    },
    isUnsubscribe: !isPage,
  });

  return { ...queryResult, data: queryResult.data ?? queryResult.previousData };
}
