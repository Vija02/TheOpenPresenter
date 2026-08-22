import { remoteTag, rendererTag } from "./naming";

// Entry to custom element

export const remoteEntrySource = (runtimeName: string) => `
import r2wc from "@r2wc/react-to-web-component";
import { PluginAPIProvider } from "@repo/base-plugin/client";
import { DialogPortalContainerContext } from "@repo/ui";
import AuthorRemote from "./__author_remote";

function RemoteEntry(props) {
  return (
    <PluginAPIProvider {...props}>
      <DialogPortalContainerContext.Provider value={props.misc.parentContainer}>
        <AuthorRemote />
      </DialogPortalContainerContext.Provider>
    </PluginAPIProvider>
  );
}

const Component = r2wc(RemoteEntry, {
  props: {
    yjsPluginSceneData: "",
    yjsPluginRendererData: "",
    awarenessContext: "",
    pluginContext: "",
    setRenderCurrentScene: "",
    trpcClient: "",
    misc: "",
  },
});

customElements.define(${JSON.stringify(remoteTag(runtimeName))}, Component);
`;

export const rendererEntrySource = (runtimeName: string) => `
import r2wc from "@r2wc/react-to-web-component";
import { PluginAPIProvider } from "@repo/base-plugin/client";
import AuthorRenderer from "./__author_renderer";

function RendererEntry(props) {
  return (
    <PluginAPIProvider {...props}>
      <AuthorRenderer />
    </PluginAPIProvider>
  );
}

const Component = r2wc(RendererEntry, {
  props: {
    yjsPluginSceneData: "",
    yjsPluginRendererData: "",
    awarenessContext: "",
    pluginContext: "",
    setRenderCurrentScene: "",
    trpcClient: "",
    misc: "",
  },
});

customElements.define(${JSON.stringify(rendererTag(runtimeName))}, Component);
`;
