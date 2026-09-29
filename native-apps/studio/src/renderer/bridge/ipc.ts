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
};

/** A link between this local server and a cloud organisation. */
export type CloudConnection = {
  id: string;
  host: string;
  organizationList: { slug: string; name: string }[];
  targetOrganizationSlug: string | null;
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

export type ProgressPayload = {
  phase: string;
  done: number;
  total: number;
  bytes?: number;
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
  beginAuth: (rootUrl?: string, next?: string) =>
    invoke<AuthBeginResult>("auth:begin", { rootUrl, next }),
  cancelAuth: () => invoke<void>("auth:cancel"),

  connect: (mode: Mode, rootUrl?: string) =>
    invoke<{ url: string }>("app:connect", { mode, rootUrl }),

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
  /** Stop and start the runtime, so an activated version takes effect. */
  restartRuntime: () =>
    invoke<{
      url: string;
      httpPort: number;
      version: string;
      lanAddress: string | null;
    }>("runtime:restart"),
  runtimeStart: (args?: { open?: boolean }) =>
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
  openWebsite: () => invoke<void>("app:website"),
  copyText: (text: string) => invoke<void>("app:copy-text", text),

  /** Cloud organisations this sign-in can see. */
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
};
