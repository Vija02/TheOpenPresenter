import { detectHost } from "./host";
import {
  closeSelf,
  listMonitors,
  listPresenting,
  onMonitorsChanged,
  onPresentingChanged,
  present,
  stopPresenting,
} from "./present";
import { canReach, localIp, openExternal } from "./system";
import type { DesktopHost } from "./types";

export { detectHost } from "./host";
export type { DesktopHost, Monitor } from "./types";

export const desktop = {
  get host(): DesktopHost {
    return detectHost();
  },

  get isDesktop(): boolean {
    return detectHost() !== "browser";
  },

  listMonitors,
  onMonitorsChanged,
  present,
  stopPresenting,
  listPresenting,
  onPresentingChanged,
  openExternal,
  localIp,
  canReach,
  closeSelf,
};

export default desktop;
