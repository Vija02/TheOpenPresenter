/** Typed access to the preload bridge from the shell's own UI. */

export type Mode = "cloud" | "selfhosted" | "local";

export type Settings = {
  mode?: Mode;
  rootUrl?: string;
  channel?: string;
  autoStartRuntime?: boolean;
  /** Whether to reopen the iroh tunnel on launch. */
  remoteAccess?: boolean;
  runtimeSource?: string;
  presentMonitor?: string;
  /**
   * Getting this computer ready to work offline, while the app is used
   * online. Kept so a restart picks up where it left off; cleared on switch.
   */
  pendingLocal?: PendingLocal;
  /** Servers signed in to from this app */
  accounts?: string[];
};

export type PendingLocal = {
  /** The account's server, which the organizations are copied from. */
  rootUrl: string;
  organizations: { slug: string; name: string }[];
};

export type RuntimeStatus =
  | { available: false; reason?: string }
  | {
      available: true;
      root: string;
      installed: string[];
      current: string | null;
      lastGood: string | null;
      migratedSchemaVersion: number;
      crashCount: number;
      running: boolean;
      runningVersion: string | null;
      url: string | null;
    };

/** Peer-to-peer remote access state. */
export type RemoteStatus = {
  enabled: boolean;
  ticket: string | null;
  node_id: string | null;
  supported?: boolean;
};

/** Versions and connection, for the About panel. */
export type AboutInfo = {
  appVersion: string;
  runtimeVersion: string | null;
  /** Activated but not running yet, when that differs from `runtimeVersion`. */
  runtimePendingVersion: string | null;
  runtimeRunning: boolean;
  managerVersion: string | null;
  electron: string;
  node: string;
  chrome: string;
  connection: string;
  mode: string;
};

/** An organisation on the cloud server. */
export type CloudOrganization = {
  slug: string;
  name: string;
  connected?: boolean;
  localName?: string | null;
};

/** An organisation on this install. */
export type LocalOrganization = {
  id: string;
  slug: string;
  name: string;
  /** The server this organization syncs to, or null when it is local-only. */
  cloudHost: string | null;
  /** The organization it mirrors on that server. */
  cloudOrganizationSlug: string | null;
  cloudConnectionId: string | null;
  /** Only owners can delete it. */
  isOwner: boolean;
  projectCount: number;
  /** The library's uploads, not what was derived from them. */
  mediaCount: number;
};

/** A link between this local server and a cloud organisation. */
export type CloudConnection = {
  id: string;
  host: string;
  organizationList: { slug: string; name: string }[];
  targetOrganizationSlug: string | null;
  localOrganizationSlug?: string;
};

/** The project phase of a connection's latest sync run. */
export type SyncProgress = {
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  syncedProjects: number;
  projectsToSync: number;
  /** Media copies after the projects, in a phase of its own. */
  mediaStatus?: "PENDING" | "SYNCING" | "SYNCED" | "FAILED";
  syncedMedia?: number;
  totalMedia?: number;
  downloadedBytes?: number;
  totalBytes?: number;
};

/** What the app is currently pointed at. Mirrors the main process summary. */
export type ConnectionSummary = {
  location: "this-computer" | "remote";
  mode: Mode;
  rootUrl: string | null;
  isCloud: boolean;
  label: string;
};

/** The signed-in user on the current instance, when the server will say. */
export type Account = {
  name: string | null;
  username: string;
  email: string | null;
};

/** An account this computer is signed in to, with its organizations. */
export type SignedInAccount = {
  rootUrl: string;
  /** "TheOpenPresenter Cloud" or the server's host. */
  label: string;
  isCloud: boolean;
  /** The account the app goes online with. */
  current: boolean;
  status: "ok" | "signed-out" | "unreachable";
  /** Null unless `status` is "ok". */
  account: Account | null;
  organizations: CloudOrganization[] | null;
};

/** How an app update is progressing. Mirrors `shell/updates.ts`. */
export type UpdateState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available"; version: string }
  | { status: "downloading"; version: string; percent: number }
  | { status: "ready"; version: string }
  | { status: "unsupported"; reason: string }
  | { status: "error"; message: string; version?: string };

export type ProgressPayload = {
  phase: string;
  done: number;
  total: number;
  bytes?: number;
};

/** Getting this computer ready to work offline. Mirrors `main/local/setup.ts`. */
export type LocalSetupState = (
  | { phase: "idle" }
  | { phase: "downloading"; progress: ProgressPayload | null }
  | { phase: "starting" }
  | ({ phase: "syncing" } & SyncView)
  | { phase: "ready"; syncFailed: boolean }
  | { phase: "failed"; message: string }
) & { canSwitch: boolean };

/** How far organization copies have got. Mirrors `main/local/syncWatch.ts`. */
export type SyncView = {
  stage: "projects" | "media";
  synced: number;
  total: number;
  /** Bytes, during media, when known. */
  bytes?: { done: number; total: number };
  /** Nothing has moved for a long while. */
  slow?: boolean;
};

/** Copies started from settings. Mirrors `main/local/firstSync.ts`. */
export type FirstSyncState =
  | { phase: "idle" }
  | ({ phase: "syncing"; names: string[] } & SyncView)
  | { phase: "done"; names: string[]; failed: boolean };

/** What the setup card in the app window shows. */
export type SetupBarContent =
  | { kind: "setup"; state: LocalSetupState; announce: boolean }
  | { kind: "sync"; state: FirstSyncState }
  | null;

/** How a runtime update is progressing. Mirrors `shell/updates.ts`. */
export type RuntimeUpdateState =
  | { status: "none" }
  | { status: "checking" }
  | { status: "available"; current: string | null; version: string }
  | {
      status: "downloading";
      version: string;
      progress: ProgressPayload | null;
    }
  | { status: "ready"; version: string; needsRestart: boolean }
  | { status: "error"; version: string; message: string };

/** Where a screen is served from: the local runtime, or a signed-in server. */
export type ScreenSource = { kind: "local" } | { kind: "remote"; host: string };

export type ScreenState =
  | "closed"
  | "open"
  | "waiting-display"
  | "waiting-server"
  | "waiting-network"
  | "failed";

/** A screen this computer shows by itself. Mirrors `screens/config.ts`. */
export type VirtualScreen = {
  id: string;
  source: ScreenSource;
  orgSlug: string;
  screenSlug: string;
  orgName?: string;
  screenName?: string;
  monitorId?: string;
  monitorName?: string;
  monitorBounds?: { x: number; y: number; width: number; height: number };
  openOnLaunch: boolean;
};

/** A configured screen, as listed: its state and the display it is on now. */
export type ListedScreen = VirtualScreen & {
  state: ScreenState;
  /** Null when its display is not connected. */
  displayId: string | null;
  /** Where it is served from, named for the list. */
  sourceLabel: string;
};

/** Screens to pick from. Mirrors `screens/sources.ts`. */
export type CatalogScreen = {
  slug: string;
  name: string;
  source: ScreenSource;
  orgSlug: string;
};
export type CatalogOrganization = {
  key: string;
  name: string;
  syncedTo: string | null;
  syncedToLabel: string | null;
  screens: CatalogScreen[];
};
export type CatalogGroup = {
  key: string;
  label: string;
  isCloud: boolean;
  account: string | null;
  organizations: CatalogOrganization[];
};
/** Starting with the computer. Mirrors `screens/loginItem.ts`. */
export type LoginItemState =
  | { status: "on" | "off" | "needs-approval" }
  | { status: "unavailable"; reason: string };

export type ScreenCatalog = { groups: CatalogGroup[]; problems: string[] };

/** A presentation clicker. Mirrors `screens/clicker.ts`. */
export type ClickerKey = "PREV" | "NEXT";
export type ClickerConfig = {
  enabled: boolean;
  device?: { id: string; name: string };
  target?: "screen" | "project";
  screenId?: string;
};
export type ClickerStatus =
  | { supported: false; reason: string }
  | {
      supported: true;
      config: ClickerConfig;
      /** "project", a virtual screen's id, or null when it needs choosing. */
      target: string | null;
      openProject: { name: string | null } | null;
      state: "off" | "no-device" | "waiting" | "listening" | "denied";
      grabbed: boolean;
      testing: boolean;
      /** Why it was turned off by itself, until it is set up again. */
      notice: string | null;
    };
export type ClickerPress = { key: ClickerKey; ok: boolean; message: string };
export type ClickerTestPress = {
  device: { id: string; name: string };
  key: ClickerKey;
};
export type ClickerTestResult = {
  devices: number;
  opened: number;
  denied: boolean;
};

export type MonitorInfo = {
  id: string;
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
  isPrimary: boolean;
};

type Bridge = {
  isDesktop: true;
  shell: "electron";
  platform: string;
  invoke(channel: string, args?: unknown): Promise<unknown>;
  on(channel: string, handler: (payload: unknown) => void): () => void;
};

declare global {
  interface Window {
    theOpenPresenterDesktop?: Bridge;
  }
}

/** The operating system the shell runs on, as Node names it. */
export const platform = (): string =>
  window.theOpenPresenterDesktop?.platform ?? "";

function bridge(): Bridge {
  const api = window.theOpenPresenterDesktop;
  if (!api) {
    throw new Error(
      "Desktop bridge unavailable. This page is not running inside the shell.",
    );
  }
  return api;
}

/**
 * Electron wraps anything an `ipcMain.handle` callback throws as
 * "Error invoking remote method '<channel>': Error: <message>". Panels show
 * these straight to the user, so the plumbing is stripped and only the
 * sentence the handler wrote is kept.
 */
export function ipcErrorMessage(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  const match = text.match(
    /^Error invoking remote method '[^']+':\s*(?:[\w.]*Error:\s*)?(.*)$/s,
  );
  return match ? match[1] : text;
}

export function invoke<T>(channel: string, args?: unknown): Promise<T> {
  return (bridge().invoke(channel, args) as Promise<T>).catch((err) => {
    throw new Error(ipcErrorMessage(err));
  });
}

export function listen<T>(
  channel: string,
  handler: (payload: T) => void,
): () => void {
  return bridge().on(channel, handler as (payload: unknown) => void);
}

export type AuthBeginResult =
  | { supported: true; authUrl: string }
  | { supported: false; reason: string };

export const api = {
  getSettings: () => invoke<Settings>("settings:get"),
  updateSettings: (patch: Partial<Settings>) =>
    invoke<Settings>("settings:update", patch),
  normalizeHost: (input: string) =>
    invoke<string>("settings:normalize-host", input),

  checkHost: (url: string) => invoke<boolean>("host:check", url),
  isLoggedIn: () => invoke<boolean>("host:logged-in"),

  /** Who is signed in to the current instance, or null when nobody is. */
  account: () => invoke<Account | null>("host:account"),
  logout: () => invoke<void>("host:logout"),

  /** Hand sign-in to the user's real browser. */
  beginAuth: (
    rootUrl?: string,
    next?: string,
    options?: { register?: boolean },
  ) =>
    invoke<AuthBeginResult>("auth:begin", {
      rootUrl,
      next,
      register: options?.register,
    }),
  cancelAuth: () => invoke<void>("auth:cancel"),

  connect: (mode: Mode, rootUrl?: string, organizationSlug?: string) =>
    invoke<{ url: string }>("app:connect", {
      mode,
      rootUrl,
      organizationSlug,
    }),

  /** What the app is pointed at right now. */
  connection: () => invoke<ConnectionSummary>("app:connection"),

  /** Open settings from a window with no menu of its own. */
  openSettings: () => invoke<void>("app:open-settings"),

  /** Try the configured instance again. Throws while it is still down. */
  retryConnection: () => invoke<void>("app:retry-connection"),

  /** Point the app at a different server, without redoing setup. */
  switchServer: (mode: Mode, rootUrl?: string) =>
    invoke<ConnectionSummary>("app:switch-server", { mode, rootUrl }),

  openExternal: (url: string) => invoke<void>("app:open-external", url),

  runtimeStatus: () => invoke<RuntimeStatus>("runtime:status"),
  runtimeCheck: (channel?: string) =>
    invoke<{ channel: string; version: string }>("runtime:check", channel),
  runtimeInstall: (channel?: string) =>
    invoke<{
      version: string;
      root: string;
      activated: boolean;
      pendingRestart: boolean;
    }>("runtime:install", channel),
  activateRuntime: (version: string) =>
    invoke<{ version: string }>("runtime:activate", version),
  /** Relaunch the app, so an activated runtime version takes effect. */
  restartRuntime: () => invoke<void>("runtime:restart"),
  runtimeStart: (args?: { open?: boolean; organizationSlug?: string }) =>
    invoke<{
      url: string;
      httpPort: number;
      version: string;
      lanAddress: string | null;
    }>("runtime:start", args),
  localAddress: () => invoke<string | null>("host:local-address"),
  runtimeOpen: () => invoke<{ url: string }>("runtime:open"),
  runtimeStop: () => invoke<void>("runtime:stop"),
  openRuntimeLogs: () => invoke<string>("runtime:open-logs"),
  runtimePaths: () =>
    invoke<{
      root: string;
      versions: string;
      data: string;
      cache: string;
      logs: string;
    }>("runtime:paths"),
  revealRuntimeFolder: (which: "data" | "root") =>
    invoke<string>("runtime:reveal", which),

  /** Peer-to-peer remote access to the local server. */
  remoteStatus: () => invoke<RemoteStatus>("runtime:remote-status"),
  startRemote: () => invoke<RemoteStatus>("runtime:remote-start"),
  stopRemote: () => invoke<RemoteStatus>("runtime:remote-stop"),

  /** Versions and connection, for the About panel. */
  aboutInfo: () => invoke<AboutInfo>("app:about"),

  /** App update state, and what a user can do about it. */
  updateState: () => invoke<UpdateState>("update:state"),
  checkForUpdate: () => invoke<UpdateState>("update:check"),
  runtimeUpdateState: () => invoke<RuntimeUpdateState>("update:runtime"),
  /** Download everything on offer: the app, the runtime, or both. */
  downloadUpdates: () => invoke<void>("update:download"),
  installUpdate: () => invoke<void>("update:install"),
  /** Close the update popup. The update itself is left as it is. */
  dismissUpdate: () => invoke<void>("update:dismiss"),
  openWebsite: () => invoke<void>("app:website"),
  copyText: (text: string) => invoke<void>("app:copy-text", text),

  /** Cloud organisations this sign-in can see. */
  /** Null when nobody is signed in or the request failed. */
  cloudOnboarding: (cloudUrl?: string) =>
    invoke<{ completed: boolean; hasOrganization: boolean } | null>(
      "cloud:onboarding",
      { cloudUrl },
    ),
  cloudOrganizations: (cloudUrl?: string) =>
    invoke<CloudOrganization[]>("cloud:organizations", { cloudUrl }),

  /** Connect one cloud organisation, creating its local mirror. */
  connectCloudOrganization: (cloudOrg: CloudOrganization, cloudUrl?: string) =>
    invoke<CloudConnection>("cloud:connect-organization", {
      cloudOrg,
      cloudUrl,
    }),

  /** Name this install's organisation, for someone not connecting. */
  createLocalOrganization: (name: string) =>
    invoke<LocalOrganization>("cloud:name-organization", name),

  /**
   * Stop syncing an organisation. Deleting is opt-in and only ever affects
   * this computer; the copy on the server is left alone.
   */
  removeCloudConnection: (args: {
    cloudConnectionId: string;
    organizationId: string;
    deleteOrganization: boolean;
  }) => invoke<void>("cloud:remove-connection", args),

  /**
   * Delete an organization from this computer.
   */
  removeOrganization: (organizationId: string) =>
    invoke<void>("cloud:remove-organization", { organizationId }),

  accounts: () => invoke<SignedInAccount[]>("accounts:list"),
  /**
   * Sign out of an account. Its copies on this computer stop syncing and
   * stay as local only, or are deleted with `deleteCopies`.
   */
  disconnectAccount: (rootUrl: string, deleteCopies: boolean) =>
    invoke<void>("accounts:disconnect", { rootUrl, deleteCopies }),
  openAccount: (rootUrl: string, organizationSlug?: string) =>
    invoke<ConnectionSummary>("accounts:open", { rootUrl, organizationSlug }),

  /** Organisations on this install. */
  localOrganizations: () =>
    invoke<LocalOrganization[]>("cloud:local-organizations"),

  /** Link the local server to a cloud organisation. */
  cloudConnect: (cloudUrl?: string) =>
    invoke<CloudConnection>("cloud:connect", { cloudUrl }),
  cloudStatus: () => invoke<CloudConnection | null>("cloud:status"),
  cloudSelectOrganization: (cloudConnectionId: string, slug: string) =>
    invoke<void>("cloud:select-organization", { cloudConnectionId, slug }),
  cloudSync: (cloudConnectionId: string) =>
    invoke<void>("cloud:sync", { cloudConnectionId }),
  syncProgress: (cloudConnectionId: string) =>
    invoke<SyncProgress | null>("cloud:sync-progress", { cloudConnectionId }),

  /** Offline setup, which runs in the background while the app is used. */
  localSetupState: () => invoke<LocalSetupState>("local-setup:state"),
  localSetupDownload: (channel?: string) =>
    invoke<void>("local-setup:download", channel),
  localSetupWaitForDownload: () => invoke<void>("local-setup:wait-download"),
  localSetupBegin: (plan: PendingLocal) =>
    invoke<{ direct: boolean }>("local-setup:begin", plan),
  localSetupRetry: () => invoke<void>("local-setup:retry"),
  localSetupSwitch: () => invoke<void>("local-setup:switch"),
  setupBarDismiss: () => invoke<void>("setup-bar:dismiss"),
  setupBarLater: () => invoke<void>("setup-bar:later"),
  setupBarContent: () => invoke<SetupBarContent>("setup-bar:content"),
  setupBarHeight: (height: number) => invoke<void>("setup-bar:height", height),
  /** Screens this computer shows by itself. */
  virtualScreens: () => invoke<ListedScreen[]>("screens:list"),
  screenCatalog: () => invoke<ScreenCatalog>("screens:catalog"),
  monitors: () => invoke<MonitorInfo[]>("present:monitors"),
  saveScreen: (screen: Omit<VirtualScreen, "id"> & { id?: string }) =>
    invoke<VirtualScreen>("screens:save", screen),
  removeScreen: (id: string) => invoke<void>("screens:remove", id),
  openScreen: (id: string) => invoke<void>("screens:open", id),
  closeScreen: (id: string) => invoke<void>("screens:close", id),
  launchAtLogin: () => invoke<LoginItemState>("screens:launch-at-login"),
  openLoginItems: () => invoke<void>("screens:open-login-items"),
  setLaunchAtLogin: (enabled: boolean) =>
    invoke<LoginItemState>("screens:set-launch-at-login", enabled),

  clickerStatus: () => invoke<ClickerStatus>("clicker:status"),
  saveClicker: (patch: Partial<ClickerConfig>) =>
    invoke<ClickerConfig>("clicker:save", patch),
  /** Report which device sends presses, until stopped. */
  startClickerTest: () => invoke<ClickerTestResult>("clicker:test-start"),
  stopClickerTest: () => invoke<void>("clicker:test-stop"),
};
