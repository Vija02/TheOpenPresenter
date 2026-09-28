import { detectHost } from "./host";
import {
  closeSelf,
  listMonitors,
  listPresenting,
  present,
  stopPresenting,
} from "./present";
import { localIp, openExternal } from "./system";
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
  present,
  stopPresenting,
  listPresenting,
  openExternal,
  localIp,
  closeSelf,
};

export default desktop;
