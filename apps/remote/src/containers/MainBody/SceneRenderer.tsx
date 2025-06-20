import { Scene } from "@repo/base-plugin";
import { ErrorAlert } from "@repo/ui";
import React from "react";
import { ErrorBoundary } from "react-error-boundary";

import PluginRenderer from "./PluginRenderer";

const SceneRenderer = React.memo(
  ({ sceneId, value }: { sceneId: string; value: Scene }) => {
    return (
      <>
        {Object.entries(value.children).map(([pluginId, pluginInfo]) => (
          <ErrorBoundary key={pluginId} FallbackComponent={ErrorAlert}>
            <PluginRenderer
              sceneId={sceneId}
              pluginId={pluginId}
              pluginInfo={pluginInfo}
            />
          </ErrorBoundary>
        ))}
      </>
    );
  },
);

export default SceneRenderer;
