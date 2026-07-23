import { PluginAPIProvider, WebComponentProps } from "@repo/base-plugin/client";

import Renderer from "../Renderer";

export default function RendererEntry(props: WebComponentProps<unknown>) {
  return (
    <PluginAPIProvider {...props}>
      <Renderer />
    </PluginAPIProvider>
  );
}
