import { withApollo } from "@/lib/withApollo";
import { ChakraProvider } from "@chakra-ui/react";
import "@fontsource-variable/inter";
import "@fontsource-variable/source-sans-3";
import { system, Chakra } from "@repo/ui";
import { AppProps } from "next/app";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import "../global.css";
import "../helper.css";

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <Chakra.Provider >
      <Component {...pageProps} />
      <ToastContainer autoClose={3000} position="bottom-center" theme="light" />
    </Chakra.Provider>
  );
}

export default withApollo(MyApp);
