export type MonitorInfo = {
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
  is_primary: boolean;
};

export type HostStatus = "unknown" | "checking" | "ok" | "down";
