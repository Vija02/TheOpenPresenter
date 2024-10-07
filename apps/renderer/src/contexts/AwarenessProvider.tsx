import isEqual from "fast-deep-equal";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Awareness } from "y-protocols/awareness";

import { usePluginData } from "./PluginDataProvider";

type AwarenessProviderType = {
  awarenessData: Record<string, any>[];
};

const initialData: AwarenessProviderType = {
  awarenessData: [],
};

export const AwarenessContext =
  createContext<AwarenessProviderType>(initialData);

export function AwarenessProvider({ children }: React.PropsWithChildren<{}>) {
  const { provider } = usePluginData();

  if (!provider || !provider.awareness) {
    return children;
  }

  return (
    <AwarenessProviderInner awareness={provider.awareness}>
      {children}
    </AwarenessProviderInner>
  );
}

function AwarenessProviderInner({
  awareness,
  children,
}: React.PropsWithChildren<{ awareness: Awareness }>) {
  const [awarenessData, setAwarenessData] = useState<Record<string, any>[]>([]);

  useEffect(() => {
    setAwarenessData((prev) => {
      const newVal = Array.from(awareness.getStates().values()) as any[];
      if (isEqual(prev, newVal)) {
        return prev;
      }
      return newVal;
    });

    const onAwarenessUpdate = () => {
      setAwarenessData((prev) => {
        const newVal = Array.from(awareness.getStates().values()) as any[];
        if (isEqual(prev, newVal)) {
          return prev;
        }
        return newVal;
      });
    };

    awareness.on("update", onAwarenessUpdate);
    return () => {
      awareness.off("update", onAwarenessUpdate);
    };
  }, [awareness]);

  return (
    <AwarenessContext.Provider
      value={{
        awarenessData,
      }}
    >
      {children}
    </AwarenessContext.Provider>
  );
}

export function useAwareness() {
  return useContext(AwarenessContext);
}
