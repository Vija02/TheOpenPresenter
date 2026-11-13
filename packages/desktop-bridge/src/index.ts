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
import {
  hasWebWindow,
  latestWebWindowId,
  openWebWindow,
  requestWebFullscreen,
  supportsFullscreenHandoff,
  supportsWindowManagement,
  windowManagementPermission,
} from "./web/screens";

export { detectHost } from "./host";
export type { DesktopHost, Monitor } from "./types";
export type { WindowManagementPermission } from "./web/screens";
export { displayKey, watchCurrentScreen } from "./web/screens";
export { getDeviceId } from "./deviceId";
export {
  FULLSCREEN_MESSAGE,
  PRESENT_WINDOW_PREFIX,
  announcePresentWindow,
  browserName,
  canCloseSelf,
  isOpenedByRemote,
  isOwnWindow,
  newWindowId,
  watchPresentWindows,
} from "./web/presentChannel";
export type { PresentWindowInfo } from "./web/presentChannel";

export const desktop = {
  get host(): DesktopHost {
    return detectHost();
  },

  get isDesktop(): boolean {
    return detectHost() !== "browser";
  },

  get canPickMonitor(): boolean {
    return detectHost() !== "browser" || supportsWindowManagement();
  },

  windowManagementPermission,

  // Browser only
  openWindow: openWebWindow,
  get canMakeWindowFullscreen(): boolean {
    return supportsFullscreenHandoff();
  },
  /** Without a window id, the output's newest window */
  requestWindowFullscreen: requestWebFullscreen,
  hasWindow: hasWebWindow,
  latestWindowId: latestWebWindowId,

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
