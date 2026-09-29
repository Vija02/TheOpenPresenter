import { type ElectronApplication, _electron } from "@playwright/test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Launching the desktop shell against a throwaway install.
 * `TOP_RUNTIME_ROOT` moves everything the app owns,so a test starts from a known state
 */

const STUDIO_DIR = join(__dirname, "../../native-apps/studio");
const MAIN = join(STUDIO_DIR, "out/main/index.js");

export type DesktopSettings = {
  mode?: "cloud" | "selfhosted" | "local";
  rootUrl?: string;
  channel?: string;
  autoStartRuntime?: boolean;
  remoteAccess?: boolean;
};

export type LaunchedApp = {
  app: ElectronApplication;
  /** The runtime root this instance was given. */
  root: string;
  close: () => Promise<void>;
};

/**
 * Start the app, optionally with settings already in place.
 *
 * Seeding settings rather than clicking through onboarding keeps each test
 * about one thing: a test for the unreachable screen should not have to drive
 * setup first.
 */
export async function launchDesktop(
  settings?: DesktopSettings,
  extraEnv: Record<string, string> = {},
): Promise<LaunchedApp> {
  const root = mkdtempSync(join(tmpdir(), "top-e2e-"));

  if (settings) {
    mkdirSync(join(root, "electron"), { recursive: true });
    writeFileSync(
      join(root, "electron", "settings.json"),
      JSON.stringify({ settings }, null, 2),
    );
  }

  const app = await _electron.launch({
    args: [MAIN],
    cwd: STUDIO_DIR,
    // `@playwright/test` lives in this workspace; Electron lives in the app's.
    executablePath: require(join(STUDIO_DIR, "node_modules/electron")),
    env: {
      ...process.env,
      TOP_RUNTIME_ROOT: root,
      // The lock is per data directory, but a developer's running app would
      // otherwise make every test quit the moment it starts.
      TOP_E2E_NO_SINGLE_INSTANCE: "1",
      ...extraEnv,
    },
    timeout: 45_000,
  });

  return {
    app,
    root,
    close: async () => {
      await app.close().catch(() => undefined);
      rmSync(root, { recursive: true, force: true });
    },
  };
}

/**
 * Wait for the window showing a given entry point.
 *
 * Matched on the HTML file rather than taken by index: startup swaps windows
 * around (loading gives way to onboarding or the unreachable screen), so
 * "the first window" is not a stable way to name one.
 */
export async function windowFor(
  app: ElectronApplication,
  entry: string,
  timeoutMs = 30_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const win of app.windows()) {
      if (win.url().includes(`${entry}.html`)) {
        await win.waitForLoadState("domcontentloaded");
        return win;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const seen = app.windows().map((w) => w.url());
  throw new Error(
    `No ${entry} window appeared within ${timeoutMs}ms. Saw: ${
      seen.join(", ") || "no windows"
    }`,
  );
}

/** Read the settings the app has persisted, to assert on what it saved. */
export function readSettings(root: string): DesktopSettings {
  const path = join(root, "electron", "settings.json");
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const raw = require("node:fs").readFileSync(path, "utf8");
    return JSON.parse(raw).settings ?? {};
  } catch {
    return {};
  }
}
