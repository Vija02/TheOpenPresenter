import type { BrowserContext } from "@playwright/test";

import { test as base } from "./projectFixture";

/**
 * Google Slides against the fake Google (e2e/scripts/fakeGoogleServer.ts).
 *
 * The server side is real: sign-in, token storage and refresh, revocation and
 * the import all run against the fake. The Drive Picker is Google's own
 * browser widget, loaded from apis.google.com, so `drivePicker` serves a
 * stand-in for that script that "picks" whatever the test asked for, and
 * reports the token the app opened it with.
 *
 * Like the Planning Center fixture, `requireFakeGoogle` checks the server is
 * really pointed at the fake, and skips (or fails in CI) otherwise.
 */

const FAKE_GOOGLE_PORT = Number(process.env.FAKE_GOOGLE_PORT || 5681);
const FAKE_GOOGLE_URL = `http://localhost:${FAKE_GOOGLE_PORT}`;
/** Read by the fake's consent screen to decide who is signing in. */
const ACCOUNT_COOKIE = "e2e_google_account";

const GAPI_URL = "https://apis.google.com/js/api.js";
const GSI_URL = "https://accounts.google.com/gsi/client";
const PICKER_REPORT_URL = "https://apis.google.com/__e2e/picker-opened";
const BROWSER_TOKEN_URL = "https://accounts.google.com/__e2e/token";

export type GoogleAccount = {
  email: string;
  name: string;
  denyAuthorization: boolean;
  withholdRefreshToken: boolean;
  expiresIn: number;
};

export type GoogleAccountActivity = {
  refreshCount: number;
  revokeCount: number;
  exportCount: number;
};

export type FakeGoogle = {
  /**
   * A fresh account id for this test. Generated, not chosen: the same spec
   * runs per browser project, concurrently, against one shared fake.
   */
  newAccountId: (label?: string) => string;
  /** Describes an account and makes it the one the next sign-in authorizes. */
  signInAs: (accountId: string, account?: Partial<GoogleAccount>) => Promise<void>;
  /** A token for Google's in-browser sign-in to hand out ("import once"). */
  browserToken: (accountId: string) => Promise<string>;
  /** As if the user removed the app's access in their Google account. */
  revokeAccess: (accountId: string) => Promise<void>;
  activity: (accountId: string) => Promise<GoogleAccountActivity>;
};

export type DrivePicker = {
  /** What the next picker opening selects. `null` cancels it. */
  willPick: (doc: { id: string; name: string } | null) => void;
  /** The token the app handed to each picker opening, in order. */
  openedWithTokens: string[];
  /** Times the app used Google's in-browser sign-in. */
  inBrowserSignIns: () => number;
  /** The token Google's in-browser sign-in hands out next. */
  signInInBrowserWith: (accessToken: string) => void;
};

type GoogleSlidesFixture = {
  fakeGoogle: FakeGoogle;
  drivePicker: DrivePicker;
  /** Skips unless the plugin is actually wired to the fake. */
  requireFakeGoogle: () => Promise<void>;
};

/**
 * Stands in for apis.google.com/js/api.js: just enough of gapi and
 * google.picker. The page loads it once, so each opening asks the test what
 * to pick, reporting the token it was given on the way.
 */
const PICKER_SCRIPT = `
(function () {

  function View() {}
  function DocsView() {}
  DocsView.prototype = Object.create(View.prototype);
  [
    "setEnableDrives", "setIncludeFolders", "setOwnedByMe",
    "setSelectFolderEnabled", "setStarred", "setMimeTypes", "setFileIds",
    "setMode", "setParent", "setQuery",
  ].forEach(function (name) {
    DocsView.prototype[name] = function () { return this; };
  });

  function PickerBuilder() { this.token = null; this.callback = null; }
  [
    "setAppId", "setDeveloperKey", "setLocale", "setMaxItems", "setOrigin",
    "setRelayUrl", "setTitle", "hideTitleBar", "enableFeature",
    "disableFeature", "addView",
  ].forEach(function (name) {
    PickerBuilder.prototype[name] = function () { return this; };
  });
  PickerBuilder.prototype.setCallback = function (cb) { this.callback = cb; return this; };
  PickerBuilder.prototype.setOAuthToken = function (t) { this.token = t; return this; };
  PickerBuilder.prototype.build = function () {
    var builder = this;
    return {
      setVisible: function (visible) {
        if (!visible) return;
        fetch(${JSON.stringify(PICKER_REPORT_URL)}, {
          method: "POST", body: builder.token || "",
        })
          .then(function (res) { return res.json(); })
          .then(function (pick) {
            builder.callback(pick
              ? { action: "picked", docs: [{
                  id: pick.id, name: pick.name,
                  mimeType: "application/vnd.google-apps.presentation",
                  url: "https://docs.google.com/presentation/d/" + pick.id,
                }] }
              : { action: "cancel" });
          });
      },
      dispose: function () {},
    };
  };

  window.google = window.google || {};
  window.google.picker = {
    View: View,
    DocsView: DocsView,
    PickerBuilder: PickerBuilder,
    ViewId: { PRESENTATIONS: "presentations", DOCS: "all" },
    DocsViewMode: { LIST: "list", GRID: "grid" },
    Feature: { MULTISELECT_ENABLED: "multi", MINE_ONLY: "mine", NAV_HIDDEN: "nav" },
    Action: { PICKED: "picked", CANCEL: "cancel", ERROR: "error" },
  };
  window.gapi = { load: function (_api, cb) { setTimeout(cb, 0); } };
})();
`;

/**
 * Stands in for accounts.google.com/gsi/client: the in-browser sign-in hands
 * over whatever token the test gave it, as if the user had approved.
 */
const GSI_SCRIPT = `
(function () {
  window.google = window.google || {};
  window.google.accounts = {
    oauth2: {
      initTokenClient: function (config) {
        return {
          requestAccessToken: function () {
            fetch(${JSON.stringify(BROWSER_TOKEN_URL)})
              .then(function (res) { return res.json(); })
              .then(function (body) {
                if (!body.accessToken) {
                  config.error_callback({ type: "popup_closed" });
                  return;
                }
                config.callback({
                  access_token: body.accessToken,
                  expires_in: 3599,
                  scope: config.scope,
                  token_type: "Bearer",
                });
              });
          },
        };
      },
    },
  };
})();
`;

const installDrivePicker = async (context: BrowserContext): Promise<DrivePicker> => {
  let nextPick: { id: string; name: string } | null = null;
  let nextBrowserToken: string | null = null;
  let signIns = 0;
  const openedWithTokens: string[] = [];

  await context.route(GAPI_URL, (route) =>
    route.fulfill({ contentType: "text/javascript", body: PICKER_SCRIPT }),
  );
  await context.route(PICKER_REPORT_URL, (route) => {
    openedWithTokens.push(route.request().postData() ?? "");
    return route.fulfill({
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(nextPick),
    });
  });
  // Only "import once" should need Google's in-browser sign-in. With a stored
  // connection the app hands the picker a token instead.
  await context.route(GSI_URL, (route) =>
    route.fulfill({ contentType: "text/javascript", body: GSI_SCRIPT }),
  );
  await context.route(BROWSER_TOKEN_URL, (route) => {
    signIns += 1;
    return route.fulfill({
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ accessToken: nextBrowserToken }),
    });
  });

  return {
    willPick: (doc) => {
      nextPick = doc;
    },
    openedWithTokens,
    inBrowserSignIns: () => signIns,
    signInInBrowserWith: (accessToken) => {
      nextBrowserToken = accessToken;
    },
  };
};

export const test = base.extend<GoogleSlidesFixture>({
  fakeGoogle: async ({ request, context }, use, testInfo) => {
    const prefix = `g-${testInfo.project.name}-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}-${Date.now().toString(36)}`;
    const created: string[] = [];

    const control = async (path: string, data: unknown) => {
      const res = await request.post(`${FAKE_GOOGLE_URL}/__control/${path}`, {
        data,
      });
      if (!res.ok()) {
        throw new Error(`fake-google ${path} failed: ${await res.text()}`);
      }
    };

    await use({
      newAccountId: (label = "account") => {
        const id = `${prefix}-${label}`;
        created.push(id);
        return id;
      },
      signInAs: async (accountId, account) => {
        await control("scenario", { accountId, account });
        await context.addCookies([
          { name: ACCOUNT_COOKIE, value: accountId, url: FAKE_GOOGLE_URL },
        ]);
      },
      browserToken: async (accountId) => {
        const res = await request.post(
          `${FAKE_GOOGLE_URL}/__control/browser-token`,
          { data: { accountId } },
        );
        return (await res.json()).accessToken;
      },
      revokeAccess: (accountId) => control("revoke", { accountId }),
      activity: async (accountId) => {
        const res = await request.get(
          `${FAKE_GOOGLE_URL}/__control/account?id=${encodeURIComponent(accountId)}`,
        );
        return res.json();
      },
    });

    // Scoped to this test's own accounts, so parallel workers are unaffected
    await Promise.all(
      created.map((accountId) =>
        control("reset", { accountId }).catch(() => {}),
      ),
    );
  },

  drivePicker: async ({ context }, use) => {
    await use(await installDrivePicker(context));
  },

  requireFakeGoogle: async ({ request, e2eCommand }, use) => {
    await use(async () => {
      const health = await request
        .get(`${FAKE_GOOGLE_URL}/__control/health`)
        .catch(() => null);
      const fakeUp = !!health?.ok();
      const wiring = await e2eCommand.serverCommand("googleSlidesWiring");
      const pointedAtFake = !!wiring.apiUrl?.includes(`:${FAKE_GOOGLE_PORT}`);

      // In CI the config starts the fake and sets the env, so anything else
      // means that broke
      if (process.env.CI) {
        if (!fakeUp) throw new Error(`fake Google not up on ${FAKE_GOOGLE_URL}`);
        if (!wiring.configured) {
          throw new Error("the server has no Google Slides client secret set");
        }
        if (!pointedAtFake) {
          throw new Error(
            `Google Slides is pointed at ${wiring.apiUrl ?? "the real Google"}, not the fake on ${FAKE_GOOGLE_URL}`,
          );
        }
        return;
      }

      test.skip(
        !fakeUp || !wiring.configured || !pointedAtFake,
        `Google Slides E2E needs the plugin pointed at the fake Google. ` +
          `Found apiUrl=${wiring.apiUrl ?? "unset"}, secret ${wiring.configured ? "set" : "missing"}, fake ${fakeUp ? "up" : "down"}. ` +
          `Stop any running dev server and use: yarn e2e test slides-google-connect`,
      );
    });
  },
});

export { expect } from "@playwright/test";
