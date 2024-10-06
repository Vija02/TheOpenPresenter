import r2wc from "@r2wc/react-to-web-component";
import { withSuspense } from "@repo/ui";
import { lazy } from "react";

import { rendererWebComponentTag } from "../../src/consts";

const Component = r2wc(withSuspense(lazy(() => import("./RendererEntry"))), {
  //@ts-ignore
  props: {
    yjsPluginSceneData: "",
    yjsPluginRendererData: "",
    awarenessContext: "",
    pluginContext: "",
    setRenderCurrentScene: "",
    trpcClient: "",
  },
});
customElements.define(rendererWebComponentTag, Component);
