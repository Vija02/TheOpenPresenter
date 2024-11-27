import r2wc from "@r2wc/react-to-web-component";
import { withSuspense } from "@repo/ui";
import { lazy } from "react";

import { remoteWebComponentTag } from "../../src/consts";

const Component = r2wc(withSuspense(lazy(() => import("./RemoteEntry"))), {
  //@ts-ignore
  props: {
    yjsPluginSceneData: "",
    yjsPluginRendererData: "",
    awarenessContext: "",
    pluginContext: "",
    setRenderCurrentScene: "",
    trpcClient: "",
    canPlayAudio: "",
  },
});
customElements.define(remoteWebComponentTag, Component);
