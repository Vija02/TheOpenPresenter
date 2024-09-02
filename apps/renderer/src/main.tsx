import { ApolloProvider } from "@apollo/client";
import { ChakraProvider } from "@chakra-ui/react";
import { ErrorAlert, theme } from "@repo/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { ErrorBoundary } from "react-error-boundary";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Router } from "wouter";

import App from "./App";
import { apolloClient } from "./apollo";
import "./index.css";
import { trpc, trpcClient } from "./trpc";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ChakraProvider theme={theme} resetCSS>
      <ErrorBoundary FallbackComponent={ErrorAlert}>
        <Router base="/render">
          <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <ApolloProvider client={apolloClient}>
              <QueryClientProvider client={queryClient}>
                <>
                  <App />
                  <ToastContainer />
                </>
              </QueryClientProvider>
            </ApolloProvider>
          </trpc.Provider>
        </Router>
      </ErrorBoundary>
    </ChakraProvider>
  </React.StrictMode>,
);
