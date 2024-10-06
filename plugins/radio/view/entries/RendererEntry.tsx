import { PluginAPIProvider, WebComponentProps } from "@repo/base-plugin/client";
import type { TRPCUntypedClient } from "@trpc/client";

import { AppRouter } from "../../src";
import Renderer from "../Renderer";

export default function RendererEntry(
  props: WebComponentProps<TRPCUntypedClient<AppRouter>>,
) {
  return (
    <PluginAPIProvider {...props}>
      <Renderer />
    </PluginAPIProvider>
  );
}
