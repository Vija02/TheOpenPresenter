import { PluginAPIProvider, WebComponentProps } from "@repo/base-plugin/client";

import Renderer from "../MWLRenderer";

export default function RendererEntry(props: WebComponentProps<any>) {
  return (
    <PluginAPIProvider {...props}>
      <Renderer />
    </PluginAPIProvider>
  );
}
