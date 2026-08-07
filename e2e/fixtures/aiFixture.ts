import { test as base } from "./projectFixture";

/**
 * Scripting for the fake AI provider (e2e/scripts/fakeAiServer.ts).
 *
 * The app server reads AI_BASE_URL once at boot, so pointing it at the fake is
 * the job of playwright.config's webServer env, not of a test. What a test can
 * do is confirm the pointing worked — `requireFakeAi` does that and skips
 * otherwise, because `reuseExistingServer` means a plain `yarn dev` server
 * carrying the real key from .env is a perfectly likely thing to find on 5678.
 */

const FAKE_AI_PORT = Number(process.env.FAKE_AI_PORT || 5679);
const FAKE_AI_URL = `http://localhost:${FAKE_AI_PORT}`;

export type FakeTurn = {
  reasoning?: string;
  content?: string;
  toolCalls?: { name: string; arguments: unknown }[];
  finishReason?: string;
  errorStatus?: number;
  streamError?: string;
  delayMs?: number;
  hang?: boolean;
};

type RecordedRequest = {
  model: string;
  messages: unknown[];
  tools: string[];
  reasoning: unknown;
  userText: string;
  hasImage: boolean;
  authorization: string;
};

export type FakeAi = {
  /**
   * A token unique to this test. Include it in the prompt text so the fake can
   * tell this test's requests from any other's.
   *
   * Generated rather than chosen: the same spec runs once per browser project,
   * concurrently, against one shared fake. A hand-picked marker is identical
   * across those runs, so they consume each other's turns and fail in ways that
   * look nothing like the cause.
   */
  marker: string;
  /** Declares what the model does for requests carrying `marker`. */
  script: (turns: FakeTurn[]) => Promise<void>;
  /** Everything the app server sent for this test's marker. */
  requests: () => Promise<RecordedRequest[]>;
};

type AiFixture = {
  fakeAi: FakeAi;
  /**
   * Skips unless the capability under test is actually wired to the fake.
   */
  requireFakeAi: (capability: string) => Promise<void>;
};

export const test = base.extend<AiFixture>({
  fakeAi: async ({ request }, use, testInfo) => {
    // Project name and repeat index included because the same test title runs
    // once per browser project, in parallel, against the one shared fake.
    const marker = `aimark-${testInfo.project.name}-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}-${Date.now().toString(36)}`;

    const fakeAi: FakeAi = {
      marker,
      script: async (turns) => {
        const res = await request.post(`${FAKE_AI_URL}/__control/script`, {
          data: { match: marker, turns },
        });
        if (!res.ok()) {
          throw new Error(`fake-ai script failed: ${await res.text()}`);
        }
      },
      requests: async () => {
        const res = await request.get(`${FAKE_AI_URL}/__control/requests`);
        const { requests: all } = (await res.json()) as {
          requests: RecordedRequest[];
        };
        return all.filter((r) => r.userText.includes(marker));
      },
    };

    await use(fakeAi);

    // Scoped to this test's own marker, so parallel workers are unaffected.
    await request
      .post(`${FAKE_AI_URL}/__control/reset`, { data: { match: marker } })
      .catch(() => {});
  },

  requireFakeAi: async ({ request, e2eCommand }, use) => {
    const fn = async (capability: string) => {
      const health = await request
        .get(`${FAKE_AI_URL}/__control/health`)
        .catch(() => null);

      const fakeUp = !!health?.ok();
      const wiring = await e2eCommand.serverCommand("aiWiring");
      const resolved = wiring.capabilities[capability];
      const pointedAtFake = !!resolved?.baseURL?.includes(`:${FAKE_AI_PORT}`);

      if (!resolved) {
        throw new Error(
          `no AI capability "${capability}" is registered. Available: ${
            Object.keys(wiring.capabilities).join(", ") || "(none)"
          }`,
        );
      }

      // In CI this is a wiring bug, not an environment quirk: the config starts
      // the fake and sets AI_BASE_URL, so anything else means that broke.
      if (process.env.CI) {
        if (!fakeUp)
          throw new Error(`fake AI provider not up on ${FAKE_AI_URL}`);
        if (!pointedAtFake) {
          throw new Error(
            `AI capability "${capability}" is pointed at ${resolved.baseURL ?? "nothing"}, not the fake on ${FAKE_AI_URL}`,
          );
        }
        return;
      }

      test.skip(
        !fakeUp || !pointedAtFake,
        `AI E2E needs capability "${capability}" pointed at the fake provider. ` +
          `Found baseURL=${resolved.baseURL ?? "unset"}, fake ${fakeUp ? "up" : "down"}. ` +
          `Stop any running dev server and use: yarn e2e test layoutAi`,
      );
    };

    await use(fn);
  },
});

export { expect } from "@playwright/test";
