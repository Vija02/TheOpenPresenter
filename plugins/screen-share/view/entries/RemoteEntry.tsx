import { PluginAPIProvider, WebComponentProps } from "@repo/base-plugin/client";
import { DialogPortalContainerContext } from "@repo/ui";

import Remote from "../Remote";

export default function RemoteEntry(props: WebComponentProps<unknown>) {
  return (
    <PluginAPIProvider {...props}>
      <DialogPortalContainerContext.Provider value={props.misc.parentContainer}>
        <Remote />
      </DialogPortalContainerContext.Provider>
    </PluginAPIProvider>
  );
}
