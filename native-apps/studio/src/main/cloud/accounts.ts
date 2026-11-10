import { ipcMain } from "electron";

import { cancelLocalSetupFor } from "../local";
import { runtime } from "../runtime/client";
import { describeConnection } from "../settings/connection";
import { sameHost } from "../settings/host";
import {
  DEFAULT_CLOUD_URL,
  getSettings,
  normalizeHost,
  updateSettings,
} from "../settings/store";
import { logShell } from "../shell/log";
import { refreshMenu } from "../shell/menu";
import { switchServer } from "../shell/switch";
import { backToShellUI, refetchServerWindows } from "../shell/windows";
import { currentAccount } from "./account";
import { allOrganizations, removeConnection } from "./connection";
import { checkHost, isLoggedIn, logout } from "./host";
import { restartLiveRefresh } from "./liveRefresh";
import { cloudOrganizations } from "./organizations";

export function rememberAccount(rootUrl: string): void {
  const url = normalizeHost(rootUrl);
  const known = getSettings().accounts ?? [];
  if (known.some((k) => sameHost(k, url))) return;
  updateSettings({ accounts: [...known, url] });
}

/** Every server worth asking whether we are signed in to it. */
async function candidateHosts(): Promise<string[]> {
  const settings = getSettings();
  const local = runtime.url
    ? await allOrganizations(runtime.url).catch(() => [])
    : [];
  const all = [
    ...(settings.accounts ?? []),
    settings.rootUrl,
    DEFAULT_CLOUD_URL,
    ...local.map((org) => org.cloudHost),
  ]
    .filter((url): url is string => !!url)
    .map((url) => normalizeHost(url));

  const unique: string[] = [];
  for (const url of all) {
    if (unique.some((u) => sameHost(u, url))) continue;
    // The local server has a session too, but it is not an account.
    if (runtime.url && sameHost(url, runtime.url)) continue;
    unique.push(url);
  }
  return unique;
}

async function signedInHosts(): Promise<string[]> {
  const hosts = await candidateHosts();
  const signedIn = await Promise.all(hosts.map((url) => isLoggedIn(url)));
  return hosts.filter((_, i) => signedIn[i]);
}

/**
 * The local server, started if it is installed but not running: its copies
 * hold their own session, so only the local server can stop them syncing.
 */
async function localServer(): Promise<string | null> {
  if (runtime.url) return runtime.url;
  const status = await runtime.status().catch(() => null);
  if (!status?.current) return null;
  return (await runtime.startRuntime()).url;
}

/**
 * Sign out of an account and stop syncing its organizations. Their copies on
 * this computer stay, as local only, unless `deleteCopies` is set.
 */
async function disconnect(rootUrl: string, deleteCopies: boolean) {
  const settings = getSettings();

  const base = await localServer();
  if (base) {
    const copies = (await allOrganizations(base)).filter((org) =>
      sameHost(org.cloudHost, rootUrl),
    );
    for (const org of copies) {
      await removeConnection(base, org.cloudConnectionId, org.id, deleteCopies);
    }
    if (copies.length > 0) {
      refetchServerWindows(base);
      void restartLiveRefresh();
    }
  }

  cancelLocalSetupFor(rootUrl);
  await logout(rootUrl);
  updateSettings({
    accounts: (settings.accounts ?? []).filter((k) => !sameHost(k, rootUrl)),
  });

  if (!sameHost(settings.rootUrl ?? null, rootUrl)) {
    refreshMenu();
    return;
  }

  // That was the account the app goes online with: pick another, or none.
  const next = (await signedInHosts()).find((url) => !sameHost(url, rootUrl));
  updateSettings({ rootUrl: next });

  if (settings.mode === "local") {
    refreshMenu();
    return;
  }

  // The window was showing the account just signed out of.
  if (runtime.url) {
    await switchServer("local");
  } else if (next) {
    await switchServer(describeConnection({ rootUrl: next }, null).mode, next);
  } else {
    backToShellUI();
  }
  refreshMenu();
}

export function registerAccountsIPC(): void {
  ipcMain.handle("accounts:list", async () => {
    const settings = getSettings();
    const hosts = await signedInHosts();

    return Promise.all(
      hosts.map(async (rootUrl) => {
        const summary = describeConnection({ mode: "cloud", rootUrl }, null);
        const account = await currentAccount(rootUrl);
        // Still listed when its server cannot say who we are, so its copies
        // stay with it and it can still be disconnected.
        const status = account
          ? "ok"
          : (await checkHost(rootUrl))
            ? "signed-out"
            : "unreachable";
        const organizations = account
          ? await cloudOrganizations(rootUrl).catch(() => null)
          : null;
        return {
          rootUrl,
          label: summary.label,
          isCloud: summary.isCloud,
          current: sameHost(settings.rootUrl ?? null, rootUrl),
          status,
          account,
          organizations,
        };
      }),
    );
  });

  ipcMain.handle(
    "accounts:disconnect",
    async (_event, args: { rootUrl: string; deleteCopies: boolean }) => {
      try {
        await disconnect(args.rootUrl, args.deleteCopies);
      } catch (err) {
        logShell("error", "[accounts] disconnect failed:", err);
        throw err;
      }
    },
  );

  ipcMain.handle(
    "accounts:open",
    (
      _event,
      {
        rootUrl,
        organizationSlug,
      }: { rootUrl: string; organizationSlug?: string },
    ) =>
      switchServer(
        describeConnection({ rootUrl }, null).mode,
        rootUrl,
        organizationSlug,
      ),
  );
}
