import { appData } from "@repo/lib";
import { OperationDefinitionNode } from "graphql";
import { Client as WSClient, createClient } from "graphql-ws";
import React from "react";
import { toast } from "react-toastify";
import {
  Provider,
  Client as URQLClient,
  cacheExchange,
  errorExchange,
  fetchExchange,
  subscriptionExchange,
} from "urql";

// Expose a method to reset the client
// https://github.com/urql-graphql/urql/issues/297#issuecomment-504782794
const URQLClientContext = React.createContext<{ resetClient: () => void }>({
  resetClient: () => {},
});
export function URQLClientProvider({ children }: React.PropsWithChildren) {
  const [client, setClient] = React.useState(makeClient());

  return (
    <URQLClientContext.Provider
      value={{
        resetClient: () => setClient(makeClient()),
      }}
    >
      <Provider value={client}>{children}</Provider>
    </URQLClientContext.Provider>
  );
}

export const useResetURQLClient = () =>
  React.useContext(URQLClientContext).resetClient;

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

const makeClient = (extraHeaders?: Record<string, string>) =>
  new URQLClient({
    url: `${window.location.origin}/graphql`,
    fetchOptions: {
      credentials: "same-origin",
      method: "POST",
      headers: {
        "CSRF-Token": appData.getCSRFToken(),
        ...extraHeaders,
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

type SimpleURQLProviderProps = React.PropsWithChildren<{
  headers: Record<string, string>;
}>;

export function SimpleURQLProvider({
  children,
  headers,
}: SimpleURQLProviderProps) {
  const [client] = React.useState(() => makeClient(headers));

  return <Provider value={client}>{children}</Provider>;
}
