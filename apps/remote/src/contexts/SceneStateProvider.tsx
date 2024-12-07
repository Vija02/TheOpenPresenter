import {
  SceneStateQuery,
  useSceneStateQuery,
  useSceneStateSubscriptionSubscription,
} from "@repo/graphql";
import React, { createContext, useContext } from "react";

type SceneStateProviderType = {
  sceneState: SceneStateQuery["initialSceneState"] | null;
};

const initialData: SceneStateProviderType = {
  sceneState: null,
};

export const SceneStateContext =
  createContext<SceneStateProviderType>(initialData);

export function SceneStateProvider({
  children,
  projectSlug,
}: React.PropsWithChildren<{ projectSlug: string }>) {
  const { data: initialSceneState } = useSceneStateQuery({
    variables: { projectSlug },
  });

  const { data: sceneState } = useSceneStateSubscriptionSubscription({
    variables: { projectSlug },
  });

  // TODO: This is not critical so we don't want to show a full blown error/loading
  // But it'll be nice to show this if there's an error somewhere (maybe at the footer)

  return (
    <SceneStateContext.Provider
      value={{
        sceneState: sceneState
          ? sceneState?.sceneState
          : initialSceneState
            ? initialSceneState.initialSceneState
            : [],
      }}
    >
      {children}
    </SceneStateContext.Provider>
  );
}

export function useSceneState() {
  return useContext(SceneStateContext);
}
