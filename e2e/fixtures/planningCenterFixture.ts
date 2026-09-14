import { test as base } from "./projectFixture";

/**
 * Scenario control for the fake Planning Center (e2e/scripts/fakePcoServer.ts).
 *
 * The app server reads the PCO env once at boot, so pointing it at the fake is
 * the job of playwright.config's webServer env, not of a test. What a test can
 * do is confirm the pointing worked — `requireFakePco` does that and skips
 * otherwise, because `reuseExistingServer` means a plain `yarn dev` server
 * carrying real PCO credentials from .env is a likely thing to find on 5678.
 */

const FAKE_PCO_PORT = Number(process.env.FAKE_PCO_PORT || 5680);
const FAKE_PCO_URL = `http://localhost:${FAKE_PCO_PORT}`;

export type PcoSong = {
  id: string;
  title: string;
  author: string | null;
  chordChart: string;
};

export type PcoPlan = {
  id: string;
  title: string;
  dates: string;
  sortDate: string;
  songs: PcoSong[];
};

export type PcoAccount = {
  organizationName: string;
  personName: string;
  noServicesAccess: boolean;
  denyAuthorization: boolean;
  serviceTypeName: string;
  plans: PcoPlan[];
};

export type FakePco = {
  /**
   * The account id this test's connections resolve to.
   *
   * Generated rather than chosen: the same spec runs once per browser project,
   * concurrently, against one shared fake. A hand-picked id is identical across
   * those runs, so they overwrite each other's fixtures and fail in ways that
   * look nothing like the cause.
   */
  accountId: string;
  /** Declares the account the next connect will authorize. */
  scenario: (account?: Partial<PcoAccount>) => Promise<void>;
};

type PlanningCenterFixture = {
  fakePco: FakePco;
  /** Skips unless the plugin is actually wired to the fake. */
  requireFakePco: () => Promise<void>;
};

export const test = base.extend<PlanningCenterFixture>({
  fakePco: async ({ request }, use, testInfo) => {
    const accountId = `pco-${testInfo.project.name}-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}-${Date.now().toString(36)}`;

    const fakePco: FakePco = {
      accountId,
      scenario: async (account) => {
        const res = await request.post(`${FAKE_PCO_URL}/__control/scenario`, {
          data: { accountId, account },
        });
        if (!res.ok()) {
          throw new Error(`fake-pco scenario failed: ${await res.text()}`);
        }
      },
    };

    await use(fakePco);

    // Scoped to this test's own account, so parallel workers are unaffected.
    await request
      .post(`${FAKE_PCO_URL}/__control/reset`, { data: { accountId } })
      .catch(() => {});
  },

  requireFakePco: async ({ request, e2eCommand }, use) => {
    const fn = async () => {
      const health = await request
        .get(`${FAKE_PCO_URL}/__control/health`)
        .catch(() => null);

      const fakeUp = !!health?.ok();
      const wiring = await e2eCommand.serverCommand("pcoWiring");
      const pointedAtFake = !!wiring.apiUrl?.includes(`:${FAKE_PCO_PORT}`);

      // In CI this is a wiring bug, not an environment quirk: the config starts
      // the fake and sets the PCO env, so anything else means that broke.
      if (process.env.CI) {
        if (!fakeUp) throw new Error(`fake PCO not up on ${FAKE_PCO_URL}`);
        if (!wiring.configured) {
          throw new Error("the server has no Planning Center credentials set");
        }
        if (!pointedAtFake) {
          throw new Error(
            `Planning Center is pointed at ${wiring.apiUrl ?? "the real API"}, not the fake on ${FAKE_PCO_URL}`,
          );
        }
        return;
      }

      test.skip(
        !fakeUp || !wiring.configured || !pointedAtFake,
        `Planning Center E2E needs the plugin pointed at the fake provider. ` +
          `Found apiUrl=${wiring.apiUrl ?? "unset"}, credentials ${wiring.configured ? "set" : "missing"}, fake ${fakeUp ? "up" : "down"}. ` +
          `Stop any running dev server and use: yarn e2e test lyrics-presenter-planning-center`,
      );
    };

    await use(fn);
  },
});

export { expect } from "@playwright/test";
