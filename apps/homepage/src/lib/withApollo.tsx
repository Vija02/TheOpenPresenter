import {
  ApolloClient,
  ApolloLink,
  ApolloProvider,
  FetchResult,
  HttpLink,
  InMemoryCache,
  Observable,
  Operation,
  from,
  split,
} from "@apollo/client";
import { onError } from "@apollo/client/link/error";
import { getDataFromTree } from "@apollo/client/react/ssr";
import {
  GraphQLError,
  OperationDefinitionNode,
  getOperationAST,
  print,
} from "graphql";
import { Client, createClient } from "graphql-ws";
import withApolloBase from "next-with-apollo";
import React from "react";
import { toast } from "react-toastify";
import WebSocket from "ws";

import { GraphileApolloLink } from "./GraphileApolloLink";

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

let _rootURL: string | null = null;
function createWsClient() {
  if (!_rootURL) {
    throw new Error("No ROOT_URL");
  }
  const url = `${_rootURL.replace(/^http/, "ws")}/graphql`;
  const isServer = typeof window === "undefined";
  return createClient({
    url,
    ...(isServer
      ? {
          webSocketImpl: WebSocket,
        }
      : {}),
  });
}

export function resetWebsocketConnection(): void {
  if (wsClient) {
    wsClient.dispose();
  }
  wsClient = createWsClient();
}

function makeSSRLink(req: any, res: any) {
  return new GraphileApolloLink({
    req,
    res,
    postgraphileMiddleware: req.app.get("postgraphileMiddleware"),
  });
}

function makeStandardLink(ROOT_URL: string, isServer: boolean) {
  _rootURL = ROOT_URL;

  let CSRF_TOKEN;
  if (!isServer) {
    const nextDataEl = document.getElementById("__NEXT_DATA__");
    if (!nextDataEl || !nextDataEl.textContent) {
      throw new Error("Cannot read from __NEXT_DATA__ element");
    }
    const data = JSON.parse(nextDataEl.textContent);
    CSRF_TOKEN = data.query.CSRF_TOKEN;
  }
  const httpLink = new HttpLink({
    uri: `${ROOT_URL}/graphql`,
    credentials: "same-origin",
    headers: {
      "CSRF-Token": CSRF_TOKEN,
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
        toast.error(`Sorry, we are unable to complete your request.`);
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

export const withApollo = withApolloBase(
  ({ initialState, ctx }) => {
    const ROOT_URL = process.env.NEXT_PUBLIC_ROOT_URL;
    if (!ROOT_URL) {
      throw new Error("ROOT_URL envvar is not set");
    }

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

    const { req, res }: any = ctx || {};
    const isServer = typeof window === "undefined";

    let mainLink;
    if (isServer) {
      mainLink =
        req && res && process.env.NEXT_PHASE !== "phase-production-build"
          ? makeSSRLink(req, res)
          : makeStandardLink(ROOT_URL, true);
    } else {
      mainLink = makeStandardLink(ROOT_URL, false);
    }

    const cache = new InMemoryCache({
      typePolicies: {
        Query: {
          queryType: true,
        },
      },
    }).restore(initialState || {});

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
  },
  {
    getDataFromTree,
    render: ({ Page, props }) => {
      return (
        <ApolloProvider client={props.apollo}>
          <Page {...props} />
        </ApolloProvider>
      );
    },
  },
);
