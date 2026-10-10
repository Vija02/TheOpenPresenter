import { ipcMain, shell } from "electron";

import { runtime } from "../runtime/client";
import {
  DEFAULT_CLOUD_URL,
  normalizeHost,
  resolveRootUrl,
} from "../settings/store";
import { openExternalSafely } from "../shell/external";
import { backToShellUI } from "../shell/windows";
import {
  BrowserLoginUnavailable,
  type LoginHandle,
  beginBrowserLogin,
} from "./auth";
import { markConnectedOrganizations } from "./connected";
import {
  type CloudConnection,
  allOrganizations,
  connectCloudOrganization,
  connectToCloud,
  existingConnection,
  localOrganization,
  nameLocalOrganization,
  removeConnection,
  selectOrganization,
  startSync,
} from "./connection";
import { checkHost, isLoggedIn, localAddress, logout } from "./host";
import { cloudOrganizations } from "./organizations";

/** Signing in, and linking this install to a cloud organisation. */
export function registerCloudIPC(): void {
  // -- Host / session -------------------------------------------------------
  ipcMain.handle("host:check", (_event, url: string) => checkHost(url));

  ipcMain.handle("host:logged-in", () =>
    isLoggedIn(resolveRootUrl(runtime.url)),
  );

  /** Who is signed in, for the account screen. Null when nobody is. */
  ipcMain.handle("host:account", async () => {
    const { currentAccount } = await import("./account");
    return currentAccount(resolveRootUrl(runtime.url));
  });

  /** How far the signed-in account is through the website's onboarding. */
  ipcMain.handle(
    "cloud:onboarding",
    async (_event, args?: { cloudUrl?: string }) => {
      const { onboardingStatus } = await import("./account");
      return onboardingStatus(args?.cloudUrl ?? DEFAULT_CLOUD_URL);
    },
  );

  ipcMain.handle("host:logout", async () => {
    await logout(resolveRootUrl(runtime.url));
    backToShellUI();
  });

  // -- Browser sign-in ------------------------------------------------------
  // The session is established in the main process and lands in the shared
  // cookie jar, so the window can simply navigate afterwards.
  let activeLogin: LoginHandle | null = null;

  ipcMain.handle(
    "auth:begin",
    async (
      event,
      args: { rootUrl?: string; next?: string; register?: boolean },
    ) => {
      activeLogin?.cancel();
      activeLogin = null;

      const url = args.rootUrl
        ? normalizeHost(args.rootUrl)
        : resolveRootUrl(runtime.url);

      try {
        const handle = await beginBrowserLogin(url, args.next ?? "/o");
        activeLogin = handle;

        // Validated because the URL is built from a host the user typed, so a
        // hostile or mistyped value must not reach the OS unchecked.
        const opened = args.register ? handle.registerUrl : handle.authUrl;
        if (!(await openExternalSafely(opened))) {
          throw new Error("The sign-in link was not a valid web address.");
        }

        handle.completed
          .then(() => {
            activeLogin = null;
            event.sender.send("auth:completed", { rootUrl: url });
          })
          .catch((err: Error) => {
            activeLogin = null;
            event.sender.send("auth:failed", { message: err.message });
          });

        return { authUrl: handle.authUrl, supported: true as const };
      } catch (err) {
        if (err instanceof BrowserLoginUnavailable) {
          // Older or Redis-less servers cannot do the handoff.
          return { supported: false as const, reason: err.message };
        }
        throw err;
      }
    },
  );

  ipcMain.handle("auth:cancel", () => {
    activeLogin?.cancel();
    activeLogin = null;
  });

  ipcMain.handle("host:local-address", () => localAddress());

  // -- Cloud connection -----------------------------------------------------
  // The local server does the talking to the cloud; the shell only supplies
  // the cookie it already holds from onboarding, and the user's choices.

  /** Adopt the shell's cloud session, returning the connection. */
  ipcMain.handle(
    "cloud:connect",
    async (_event, args?: { cloudUrl?: string }) => {
      const base = runtime.url;
      if (!base) throw new Error("The local server is not running.");
      return connectToCloud(base, args?.cloudUrl ?? DEFAULT_CLOUD_URL);
    },
  );

  /** The connection for this install, if it has one. */
  ipcMain.handle("cloud:status", async (): Promise<CloudConnection | null> => {
    const base = runtime.url;
    if (!base) return null;
    const org = await localOrganization(base).catch(() => null);
    if (!org) return null;
    return existingConnection(base, org.slug).catch(() => null);
  });

  ipcMain.handle(
    "cloud:select-organization",
    async (_event, args: { cloudConnectionId: string; slug: string }) => {
      const base = runtime.url;
      if (!base) throw new Error("The local server is not running.");
      await selectOrganization(base, args.cloudConnectionId, args.slug);
    },
  );

  ipcMain.handle(
    "cloud:sync",
    async (_event, args: { cloudConnectionId: string }) => {
      const base = runtime.url;
      if (!base) throw new Error("The local server is not running.");
      await startSync(base, args.cloudConnectionId);
    },
  );

  /**
   * Cloud organisations available to sign-in, before any connection exists.
   * Each is flagged with whether this install already mirrors it
   */
  ipcMain.handle(
    "cloud:organizations",
    async (_event, args?: { cloudUrl?: string }) => {
      const cloudUrl = args?.cloudUrl ?? DEFAULT_CLOUD_URL;
      const organizations = await cloudOrganizations(cloudUrl);

      const local = runtime.url
        ? await allOrganizations(runtime.url).catch(() => [])
        : [];

      return markConnectedOrganizations(organizations, local, cloudUrl);
    },
  );

  /** Connect one cloud organisation, creating its local mirror. */
  ipcMain.handle(
    "cloud:connect-organization",
    async (
      _event,
      args: { cloudOrg: { slug: string; name: string }; cloudUrl?: string },
    ) => {
      if (!runtime.url) throw new Error("The local server is not running.");
      return connectCloudOrganization(
        runtime.url,
        args.cloudUrl ?? DEFAULT_CLOUD_URL,
        args.cloudOrg,
      );
    },
  );

  /** Every organisation on this install, cloud-backed or not. */
  ipcMain.handle("cloud:local-organizations", async () => {
    if (!runtime.url) throw new Error("The local server is not running.");
    return allOrganizations(runtime.url);
  });

  /** Name this install's organisation, for someone not connecting. */
  ipcMain.handle("cloud:name-organization", async (_event, name: string) => {
    if (!runtime.url) throw new Error("The local server is not running.");
    return nameLocalOrganization(runtime.url, name);
  });

  /** Stop syncing an organisation, optionally deleting it locally. */
  ipcMain.handle(
    "cloud:remove-connection",
    async (
      _event,
      args: {
        cloudConnectionId: string;
        organizationId: string;
        deleteOrganization: boolean;
      },
    ) => {
      if (!runtime.url) throw new Error("The local server is not running.");
      return removeConnection(
        runtime.url,
        args.cloudConnectionId,
        args.organizationId,
        args.deleteOrganization,
      );
    },
  );
}
