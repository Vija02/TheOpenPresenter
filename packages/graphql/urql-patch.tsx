import { OperationDefinitionNode } from "graphql";
import { useMemo } from "react";
import {
  AnyVariables,
  UseQueryArgs,
  UseQueryResponse,
  useQuery as useQueryT,
} from "urql";
import { useSubscribe } from "use-pubsub-js";

// Re-export everything from urql except useQuery
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
  useMutation,
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
