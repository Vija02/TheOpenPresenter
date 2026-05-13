import { DocumentNode, OperationDefinitionNode } from "graphql";
import { useCallback, useMemo } from "react";
import {
  AnyVariables,
  OperationContext,
  OperationResult,
  TypedDocumentNode,
  UseMutationState,
  UseQueryArgs,
  UseQueryResponse,
  useMutation as useMutationT,
  useQuery as useQueryT,
} from "urql";
import { useSubscribe } from "use-pubsub-js";

// Re-export everything from urql except useQuery and useMutation
export * from "@urql/core";

export {
  Consumer,
  Context,
  Mutation,
  type MutationProps,
  type MutationState,
  Provider,
  Query,
  type QueryProps,
  type QueryState,
  Subscription,
  type SubscriptionHandler,
  type SubscriptionProps,
  type SubscriptionState,
  type UseMutationExecute,
  type UseMutationResponse,
  type UseMutationState,
  type UseQueryArgs,
  type UseQueryExecute,
  type UseQueryResponse,
  type UseQueryState,
  type UseSubscriptionArgs,
  type UseSubscriptionExecute,
  type UseSubscriptionResponse,
  type UseSubscriptionState,
  useClient,
  useSubscription,
} from "urql";

export function useQuery<
  Data = any,
  Variables extends AnyVariables = AnyVariables,
>(args: UseQueryArgs<Variables, Data>): UseQueryResponse<Data, Variables> {
  const [queryState, refetch] = useQueryT<Data, Variables>(args);

  const isPage = useMemo(() => {
    const operationDefinition = queryState.operation?.query.definitions.find(
      (def) => def.kind === "OperationDefinition",
    ) as OperationDefinitionNode;

    if (!!operationDefinition) {
      return operationDefinition?.name?.value.endsWith("Page");
    }
    return false;
  }, [queryState]);

  // Automatically subscribe to "page" if the name of the query ends with "Page"
  // This is "magic" through name convention but will be very useful for us.
  useSubscribe({
    token: "page",
    handler: () => {
      refetch();
    },
    isUnsubscribe: !isPage,
  });

  return [queryState, refetch];
}

export type UseApolloMutationExecute<
  Data = any,
  Variables extends AnyVariables = AnyVariables,
> = (
  variables: Variables,
  context?: Partial<OperationContext>,
) => Promise<OperationResult<Data, Variables>["data"]>;

export type UseApolloMutationResponse<
  Data = any,
  Variables extends AnyVariables = AnyVariables,
> = [UseMutationState<Data, Variables>, UseApolloMutationExecute<Data, Variables>];

// Patch urql's useMutation to throw on error and resolve with data directly,
// matching Apollo's mutate() behaviour.
export function useMutation<
  Data = any,
  Variables extends AnyVariables = AnyVariables,
>(
  query: DocumentNode | TypedDocumentNode<Data, Variables> | string,
): UseApolloMutationResponse<Data, Variables> {
  const [state, execute] = useMutationT<Data, Variables>(query);

  const executeMutation = useCallback<UseApolloMutationExecute<Data, Variables>>(
    async (variables, context) => {
      const res = await execute(variables, context);
      if (res.error) {
        throw res.error;
      }
      return res.data;
    },
    [execute],
  );

  return [state, executeMutation];
}
