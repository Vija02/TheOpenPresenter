import type { DocumentNode, OperationVariables, QueryHookOptions } from "@apollo/client";
import { useQuery as useQueryT } from "@apollo/client";

export * from "@apollo/client/react";

// This makes all the "data" field not undefined when refetch
// https://github.com/apollographql/apollo-client/issues/7038#issuecomment-694853559
export function useQuery<TData, TVariables extends OperationVariables>(
  query: DocumentNode,
  options?: QueryHookOptions<TData, TVariables>
) {
  const queryResult = useQueryT<TData, TVariables>(query, options);

  return { ...queryResult, data: queryResult.data ?? queryResult.previousData };
}
