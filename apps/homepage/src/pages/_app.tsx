import { withApollo } from "@/lib/withApollo";
import { ChakraProvider } from "@chakra-ui/react";
import "@fontsource-variable/inter";
import "@fontsource-variable/source-sans-3";
import { theme } from "@repo/ui";
import { AppProps } from "next/app";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ChakraProvider theme={theme} resetCSS>
      <Component {...pageProps} />
      <ToastContainer autoClose={3000} position="bottom-center" theme="light" />
    </ChakraProvider>
  );
}

export default withApollo(MyApp);
