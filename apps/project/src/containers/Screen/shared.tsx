import { useEffect, useState } from "react";

export const formatSeconds = (v: number) => `${v}s`;
export const parseSeconds = (s: string) => parseFloat(s.replace(/s\s*$/i, ""));

export const useTickingRemainingSeconds = (targetMs: number | null) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (targetMs === null) return;
    const handle = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(handle);
  }, [targetMs]);
  if (targetMs === null) return 0;
  return Math.max(0, Math.ceil((targetMs - now) / 1000));
};

export const useTickingElapsedSeconds = (sinceMs: number | null) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (sinceMs === null) return;
    const handle = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(handle);
  }, [sinceMs]);
  if (sinceMs === null) return 0;
  return Math.max(0, Math.floor((now - sinceMs) / 1000));
};
