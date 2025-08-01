import {
  ApolloClient,
  ApolloLink,
  FetchResult,
  HttpLink,
  InMemoryCache,
  Observable,
  Operation,
  from,
  split,
} from "@apollo/client";
import { onError } from "@apollo/client/link/error";
import { appData } from "@repo/lib";
import {
  GraphQLError,
  OperationDefinitionNode,
  getOperationAST,
  print,
} from "graphql";
import { Client, createClient } from "graphql-ws";
import { toast } from "react-toastify";

let wsClient: Client | null = null;

class WebSocketLink extends ApolloLink {
  public request(operation: Operation): Observable<FetchResult> {
    return new Observable((sink) => {
      if (!wsClient) {
        sink.error(new Error("No websocket connection"));
        return;
      }
      return wsClient.subscribe<FetchResult>(
        { ...operation, query: print(operation.query) },
        {
          // @ts-ignore
          next: sink.next.bind(sink),
          complete: sink.complete.bind(sink),
          error: (err) => {
            if (err instanceof Error) {
              sink.error(err);
            } else if (err instanceof CloseEvent) {
              sink.error(
                new Error(
                  `Socket closed with event ${err.code}` + err.reason
                    ? `: ${err.reason}` // reason will be available on clean closes
                    : "",
                ),
              );
            } else {
              sink.error(
                new Error(
                  (err as GraphQLError[])
                    .map(({ message }) => message)
                    .join(", "),
                ),
              );
            }
          },
        },
      );
    });
  }
}

function createWsClient() {
  const url = `${window.location.origin.replace(/^http/, "ws")}/graphql`;
  return createClient({
    url,
  });
}

export function resetWebsocketConnection(): void {
  if (wsClient) {
    wsClient.dispose();
  }
  wsClient = createWsClient();
}

function makeStandardLink() {
  const httpLink = new HttpLink({
    uri: `${window.location.origin}/graphql`,
    credentials: "same-origin",
    headers: {
      "CSRF-Token": appData.getCSRFToken(),
    },
  });
  wsClient = createWsClient();
  const wsLink = new WebSocketLink();

  const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
    const operationDefinitionNode = operation.query.definitions.find(
      (d) => d.kind === "OperationDefinition",
    ) as OperationDefinitionNode;
    const isMutation = operationDefinitionNode.operation === "mutation";

    if (graphQLErrors) {
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
  });

  // Using the ability to split links, you can send data to each link
  // depending on what kind of operation is being sent.
  const mainLink = from([
    errorLink,
    split(
      // split based on operation type
      ({ query, operationName }) => {
        const op = getOperationAST(query, operationName);
        return (op && op.operation === "subscription") || false;
      },
      wsLink,
      httpLink,
    ),
  ]);
  return mainLink;
}

const getApolloClient = () => {
  const onErrorLink = onError(({ graphQLErrors, networkError }) => {
    if (graphQLErrors)
      graphQLErrors.map(({ message, locations, path }) =>
        console.error(
          `[GraphQL error]: message: ${message}, location: ${JSON.stringify(
            locations,
          )}, path: ${JSON.stringify(path)}`,
        ),
      );
    if (networkError) console.error(`[Network error]: ${networkError}`);
  });

  const mainLink = makeStandardLink();

  const cache = new InMemoryCache({
    typePolicies: {
      Query: {
        queryType: true,
      },
    },
  });

  const client = new ApolloClient({
    defaultOptions: {
      watchQuery: {
        fetchPolicy: "cache-and-network",
        refetchWritePolicy: "overwrite",
        canonizeResults: true,
      },
    },
    link: ApolloLink.from([onErrorLink, mainLink]),
    cache,
  });

  return client;
};

export const apolloClient = getApolloClient();
