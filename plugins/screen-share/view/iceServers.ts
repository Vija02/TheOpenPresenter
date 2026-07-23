import { useEffect, useState } from "react";

import { IceServer } from "../src/types";

// ICE servers are effectively static per deploy, so cache it
let cachedPromise: Promise<IceServer[]> | null = null;

const fetchIceServers = (): Promise<IceServer[]> => {
  if (!cachedPromise) {
    cachedPromise = fetch("/plugin/screen-share/ice-servers")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`ICE fetch failed: ${res.status}`);
        }
        return res.json() as Promise<IceServer[]>;
      })
      .catch((err) => {
        cachedPromise = null;
        throw err;
      });
  }
  return cachedPromise;
};

export const useIceServers = () => {
  const [data, setData] = useState<IceServer[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchIceServers()
      .then((servers) => {
        if (!active) return;
        setData(servers);
        setIsLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { data, isLoading };
};
