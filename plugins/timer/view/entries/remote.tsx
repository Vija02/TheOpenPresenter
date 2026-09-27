import r2wc from "@r2wc/react-to-web-component";
import { lazyWithRetry } from "@repo/ui";

import { remoteWebComponentTag } from "../../src/consts";

const Component = r2wc(
  lazyWithRetry(() => import("./RemoteEntry")),
  {
    //@ts-ignore
    props: {
      yjsPluginSceneData: "",
      yjsPluginRendererData: "",
      awarenessContext: "",
      pluginContext: "",
      setRenderCurrentScene: "",
      trpcClient: "",
      misc: "",
    },
  },
);
customElements.define(remoteWebComponentTag, Component);
