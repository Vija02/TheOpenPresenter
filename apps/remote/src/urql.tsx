import { appData } from "@repo/lib";
import { OperationDefinitionNode } from "graphql";
import { Client as WSClient, createClient } from "graphql-ws";
import { toast } from "react-toastify";
import {
  Client as URQLClient,
  cacheExchange,
  errorExchange,
  fetchExchange,
  subscriptionExchange,
} from "urql";

let wsClient: WSClient = createWsClient();

function createWsClient() {
  const url = `${window.location.origin.replace(/^http/, "ws")}/graphql`;
  return createClient({
    url,
  });
}
export function resetWebsocketConnection(): void {
  wsClient.dispose();
  wsClient = createWsClient();
}

export const urqlClient = new URQLClient({
  url: `${window.location.origin}/graphql`,
  fetchOptions: {
    credentials: "same-origin",
    method: "POST",
    headers: {
      "CSRF-Token": appData.getCSRFToken(),
    },
  },
  preferGetMethod: false,
  requestPolicy: "cache-and-network",
  exchanges: [
    cacheExchange,
    fetchExchange,
    subscriptionExchange({
      forwardSubscription(request) {
        const input = { ...request, query: request.query || "" };
        return {
          subscribe(sink) {
            const unsubscribe = wsClient!.subscribe(input, sink);
            return { unsubscribe };
          },
        };
      },
    }),
    errorExchange({
      onError: ({ graphQLErrors, networkError }, operation) => {
        const operationDefinitionNode = operation.query.definitions.find(
          (d) => d.kind === "OperationDefinition",
        ) as OperationDefinitionNode;
        const isMutation = operationDefinitionNode.operation === "mutation";

        if (graphQLErrors.length > 0) {
          if (isMutation) {
            toast.error(`Sorry, we are unable to complete your request.`, {
              toastId: "graphQLError",
            });
          }
          graphQLErrors.forEach(({ message, locations, path }) =>
            console.log(
              `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`,
            ),
          );
        }
        if (networkError) {
          toast.error(
            `Sorry, an error occurred while contacting the server. Please try again.`,
            {
              toastId: "networkError",
            },
          );
          console.log(`[Network error]: ${networkError}`);
        }
      },
    }),
  ],
});
