import { withApollo } from "@/lib/withApollo";
import { Box, ChakraProvider, Text } from "@chakra-ui/react";
import "@fontsource-variable/inter";
import "@fontsource-variable/source-sans-3";
import { theme } from "@repo/ui";
import { AppProps } from "next/app";
import { Router } from "next/router";
import NProgress from "nprogress";
import "nprogress/nprogress.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import "../global.css";
import "../helper.css";

NProgress.configure({
  showSpinner: false,
});

if (typeof window !== "undefined") {
  Router.events.on("routeChangeStart", () => {
    console.log("HUH");
    NProgress.start();
  });

  Router.events.on("routeChangeComplete", () => {
    NProgress.done();
  });
  Router.events.on("routeChangeError", (err: Error | string) => {
    NProgress.done();
    if (typeof err !== "string" && "cancelled" in err) {
      // No worries; you deliberately cancelled it
    } else {
      toast.error(
        <Box>
          <Text fontWeight="bold">Page load failed</Text>
          <Text>
            Sorry about that! Please reload the page. Further error details:{" "}
            {typeof err === "string" ? err : err.message}
          </Text>
        </Box>,
        { position: "top-right", hideProgressBar: true, autoClose: 7000 },
      );
    }
  });
}

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ChakraProvider theme={theme} resetCSS>
      <Component {...pageProps} />
      <ToastContainer autoClose={3000} position="bottom-center" theme="light" />
    </ChakraProvider>
  );
}

export default withApollo(MyApp);
