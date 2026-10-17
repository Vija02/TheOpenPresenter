import type { BrowserContext } from "@playwright/test";

import { test as base } from "./projectFixture";

/**
 * Canva against the fake Canva (e2e/scripts/fakeCanvaServer.ts).
 *
 * Everything on the app's side is real: sign-in, connections, one-time grants,
 * the design list and the export the import downloads. Unlike Google, Canva
 * has no browser widget, so nothing in the page needs stubbing.
 *
 * `requireFakeCanva` checks the server is really pointed at the fake, and
 * skips (or fails in CI) otherwise.
 */

const FAKE_CANVA_PORT = Number(process.env.FAKE_CANVA_PORT || 5682);
const FAKE_CANVA_URL = `http://localhost:${FAKE_CANVA_PORT}`;
/** Read by the fake's consent screen to decide who is signing in. */
const ACCOUNT_COOKIE = "e2e_canva_account";

export type CanvaAccount = {
  displayName: string;
  designs: { id: string; title: string }[];
  denyAuthorization: boolean;
};

export type FakeCanva = {
  /**
   * A fresh account id for this test. Generated, not chosen: the same spec
   * runs per browser project, concurrently, against one shared fake.
   */
  newAccountId: (label?: string) => string;
  /**
   * Describes an account and makes it the one the next sign-in in `context`
   * authorizes. Defaults to the test's own context; pass a visitor's.
   */
  signInAs: (
    accountId: string,
    account?: Partial<CanvaAccount>,
    context?: BrowserContext,
  ) => Promise<void>;
  /** Designs exported from the account so far. */
  exportCount: (accountId: string) => Promise<number>;
};

type CanvaFixture = {
  fakeCanva: FakeCanva;
  /** Skips unless the plugin is actually wired to the fake. */
  requireFakeCanva: () => Promise<void>;
};

export const test = base.extend<CanvaFixture>({
  fakeCanva: async ({ request, context }, use, testInfo) => {
    const prefix = `c-${testInfo.project.name}-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}-${Date.now().toString(36)}`;
    const created: string[] = [];

    const control = async (path: string, data: unknown) => {
      const res = await request.post(`${FAKE_CANVA_URL}/__control/${path}`, {
        data,
      });
      if (!res.ok()) {
        throw new Error(`fake-canva ${path} failed: ${await res.text()}`);
      }
    };

    await use({
      newAccountId: (label = "account") => {
        const id = `${prefix}-${label}`;
        created.push(id);
        return id;
      },
      signInAs: async (accountId, account, inContext = context) => {
        await control("scenario", { accountId, account });
        await inContext.addCookies([
          { name: ACCOUNT_COOKIE, value: accountId, url: FAKE_CANVA_URL },
        ]);
      },
      exportCount: async (accountId) => {
        const res = await request.get(
          `${FAKE_CANVA_URL}/__control/account?id=${encodeURIComponent(accountId)}`,
        );
        return (await res.json()).exportCount;
      },
    });

    // Scoped to this test's own accounts, so parallel workers are unaffected
    await Promise.all(
      created.map((accountId) =>
        control("reset", { accountId }).catch(() => {}),
      ),
    );
  },

  requireFakeCanva: async ({ request, e2eCommand }, use) => {
    await use(async () => {
      const health = await request
        .get(`${FAKE_CANVA_URL}/__control/health`)
        .catch(() => null);
      const fakeUp = !!health?.ok();
      const wiring = await e2eCommand.serverCommand("canvaWiring");
      const pointedAtFake = !!wiring.apiUrl?.includes(`:${FAKE_CANVA_PORT}`);

      // In CI the config starts the fake and sets the env, so anything else
      // means that broke
      if (process.env.CI) {
        if (!fakeUp) throw new Error(`fake Canva not up on ${FAKE_CANVA_URL}`);
        if (!wiring.configured) {
          throw new Error("the server has no Canva client id and secret set");
        }
        if (!pointedAtFake) {
          throw new Error(
            `Canva is pointed at ${wiring.apiUrl ?? "the real Canva"}, not the fake on ${FAKE_CANVA_URL}`,
          );
        }
        return;
      }

      test.skip(
        !fakeUp || !wiring.configured || !pointedAtFake,
        `Canva E2E needs the plugin pointed at the fake Canva. ` +
          `Found apiUrl=${wiring.apiUrl ?? "unset"}, credentials ${wiring.configured ? "set" : "missing"}, fake ${fakeUp ? "up" : "down"}. ` +
          `Stop any running dev server and use: yarn e2e test slides-canva`,
      );
    });
  },
});

export { expect } from "@playwright/test";
