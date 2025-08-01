import { ApolloProvider } from "@apollo/client";
import { ChakraProvider } from "@chakra-ui/react";
import "@fontsource-variable/inter";
import "@fontsource-variable/source-sans-3";
import { ErrorAlert } from "@repo/ui";
import "@repo/ui/css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NProgress from "nprogress";
import "nprogress/nprogress.css";
import { StrictMode } from "react";
import "react-calendar/dist/Calendar.css";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "react-error-boundary";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Router } from "wouter";

import App from "./App";
import { apolloClient } from "./apollo";
import "./index.css";
import { theme } from "./lib/theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

NProgress.configure({
  showSpinner: false,
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary FallbackComponent={ErrorAlert}>
      <ChakraProvider theme={theme} resetCSS>
        <Router>
          <ApolloProvider client={apolloClient}>
            <QueryClientProvider client={queryClient}>
              <App />
              <ToastContainer />
            </QueryClientProvider>
          </ApolloProvider>
        </Router>
      </ChakraProvider>
    </ErrorBoundary>
  </StrictMode>,
);
