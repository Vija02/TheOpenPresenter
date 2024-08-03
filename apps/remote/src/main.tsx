import { ApolloProvider } from "@apollo/client";
import { ChakraProvider } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Router } from "wouter";

import App from "./App";
import { apolloClient } from "./apollo";
import { PluginMetaDataProvider } from "./contexts/PluginMetaDataProvider";
import { trpc, trpcClient } from "./trpc";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ChakraProvider resetCSS>
      <Router base="/app">
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <ApolloProvider client={apolloClient}>
            <QueryClientProvider client={queryClient}>
              <PluginMetaDataProvider>
                <>
                  <App />
                  <ToastContainer />
                </>
              </PluginMetaDataProvider>
            </QueryClientProvider>
          </ApolloProvider>
        </trpc.Provider>
      </Router>
    </ChakraProvider>
  </React.StrictMode>,
);
