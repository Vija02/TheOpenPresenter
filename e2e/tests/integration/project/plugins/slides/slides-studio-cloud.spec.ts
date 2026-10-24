import { type Page, mergeTests } from "@playwright/test";

import { test as canvaTest } from "../../../../../fixtures/canvaFixture";
import { test as googleTest } from "../../../../../fixtures/googleSlidesFixture";
import { expect } from "../../../../../fixtures/projectFixture";
import { ORG_SLUG } from "../../../../../helpers/workerData";

/**
 * The cloud's half of Google Slides and Canva for Studio. Studio has no client
 * secrets: it calls these routes over its cloud connection, and the user signs
 * in and picks in the system browser on the cloud.
 *
 * Here the e2e server is the cloud. Studio's calls are made as Studio makes
 * them, with the session cookie and the org's slug in a header, and the
 * browser half is a page visiting the URL Studio would open. Studio's own
 * half (its UI and the import itself) is not covered: it needs a second
 * server linked to this one.
 */

const test = mergeTests(canvaTest, googleTest);

const DECK = { id: "deck-sunday", name: "Sunday Service" };

/** Calls a cloud route the way Studio does. */
const cloud = (page: Page, orgSlug = ORG_SLUG) => {
  const headers = {
    "x-top-organization-slug": orgSlug,
    "x-top-csrf-protection": "1",
  };
  return {
    get: (path: string, params?: Record<string, string>) =>
      page.request.get(`/plugin/slides/${path}`, { headers, params }),
    post: (path: string, data: unknown = {}) =>
      page.request.post(`/plugin/slides/${path}`, { headers, data }),
  };
};

type Intent<T> = {
  status: "pending" | "done" | "failed";
  result: T | null;
  error: string | null;
};

/** The URL Studio opens in the system browser, visited in a new tab. */
const visitInBrowser = async (page: Page, url: string) => {
  const tab = await page.context().newPage();
  await tab.goto(url);
  return tab;
};

test.describe("Slides Plugin - Studio through the cloud", () => {
  test.beforeEach(
    async ({ e2eCommand, requireFakeCanva, requireFakeGoogle }) => {
      await e2eCommand.clearWorkerData();
      await requireFakeCanva();
      await requireFakeGoogle();
    },
  );

  test.describe("Canva", () => {
    const signIn = async (page: Page, mode: "connect" | "once") => {
      const begin = await cloud(page).post("canva/remote/begin", { mode });
      expect(begin.ok()).toBe(true);
      const { intentId, url } = await begin.json();

      const pending = await cloud(page).get("canva/remote/intent", {
        id: intentId,
      });
      expect((await pending.json()).status).toBe("pending");

      const tab = await visitInBrowser(page, url);
      return { intentId, tab };
    };

    const intentOf = async (page: Page, intentId: string) => {
      const res = await cloud(page).get("canva/remote/intent", {
        id: intentId,
      });
      return (await res.json()) as Intent<
        { connectionId: string } | { grantId: string }
      >;
    };

    test("connects an account for Studio, which can then use and disconnect it", async ({
      page,
      loginAndGoToProject,
      fakeCanva,
    }) => {
      const account = fakeCanva.newAccountId();
      await fakeCanva.signInAs(account, { displayName: "Worship Team" });
      await loginAndGoToProject();

      const { intentId, tab } = await signIn(page, "connect");
      await expect(tab.getByText("Signed in to Canva.")).toBeVisible();

      const intent = await intentOf(page, intentId);
      expect(intent.status).toBe("done");
      const connectionId = (intent.result as { connectionId: string })
        .connectionId;

      const status = await (
        await cloud(page).get("canva/remote/status")
      ).json();
      expect(status.connections).toEqual([
        expect.objectContaining({ id: connectionId, label: "Worship Team" }),
      ]);

      const token = await cloud(page).post("canva/remote/token", {
        connectionId,
      });
      expect(token.ok()).toBe(true);
      expect((await token.json()).accessToken).toMatch(/^access-/);

      expect(
        (
          await cloud(page).post("canva/remote/disconnect", { connectionId })
        ).status(),
      ).toBe(200);
      const after = await (await cloud(page).get("canva/remote/status")).json();
      expect(after.connections).toEqual([]);

      const gone = await cloud(page).post("canva/remote/token", {
        connectionId,
      });
      expect(gone.status()).toBe(404);
      expect((await gone.json()).error).toBe(
        "That Canva account is no longer connected.",
      );
    });

    test("import once connects nothing, and the import uses its grant up", async ({
      page,
      loginAndGoToProject,
      fakeCanva,
    }) => {
      const account = fakeCanva.newAccountId();
      await fakeCanva.signInAs(account, { displayName: "Visiting Speaker" });
      await loginAndGoToProject();

      const { intentId, tab } = await signIn(page, "once");
      await expect(tab.getByText("Signed in to Canva.")).toBeVisible();

      const intent = await intentOf(page, intentId);
      expect(intent.status).toBe("done");
      const { grantId } = intent.result as { grantId: string };
      expect(grantId).toBeTruthy();

      const status = await (
        await cloud(page).get("canva/remote/status")
      ).json();
      expect(status.connections).toEqual([]);

      // Listing designs leaves it; the import consumes it
      expect(
        (await cloud(page).post("canva/remote/token", { grantId })).ok(),
      ).toBe(true);
      expect(
        (
          await cloud(page).post("canva/remote/token", {
            grantId,
            consume: true,
          })
        ).ok(),
      ).toBe(true);
      const spent = await cloud(page).post("canva/remote/token", { grantId });
      expect(spent.status()).toBe(404);
    });

    test("a cancelled sign-in is reported to Studio", async ({
      page,
      loginAndGoToProject,
      fakeCanva,
    }) => {
      const account = fakeCanva.newAccountId();
      await fakeCanva.signInAs(account, { denyAuthorization: true });
      await loginAndGoToProject();

      const { intentId, tab } = await signIn(page, "connect");
      await expect(tab.getByText("Canva sign-in was cancelled.")).toBeVisible();

      const intent = await intentOf(page, intentId);
      expect(intent.status).toBe("failed");
      expect(intent.error).toBe("Canva sign-in was cancelled.");

      const status = await (
        await cloud(page).get("canva/remote/status")
      ).json();
      expect(status.connections).toEqual([]);
    });

    test("an organization the caller is not in is refused", async ({
      page,
      loginAndGoToProject,
    }) => {
      await loginAndGoToProject();
      const res = await cloud(page, "not-my-org").post("canva/remote/begin", {
        mode: "connect",
      });
      expect(res.status()).toBe(403);
    });
  });

  test.describe("Google Slides", () => {
    type PickResult = {
      presentationId: string;
      name: string | null;
      connectionId: string | null;
      accessToken?: string;
    };

    /** Starts a pick and walks it through in the browser, to "Done". */
    const pick = async (
      page: Page,
      input: {
        mode: "pick" | "connect" | "once";
        connectionId?: string;
      },
    ) => {
      const begin = await cloud(page).post("google/remote/pick", input);
      expect(begin.ok()).toBe(true);
      const { intentId, url } = await begin.json();

      const tab = await visitInBrowser(page, url);
      await expect(tab.getByText(/^Done\./)).toBeVisible();

      const res = await cloud(page).get("google/remote/intent", {
        id: intentId,
      });
      const intent = (await res.json()) as Intent<PickResult>;
      expect(intent.status).toBe("done");
      return intent.result!;
    };

    const accountsOf = async (page: Page) =>
      (await (await cloud(page).get("google/remote/status")).json())
        .accounts as { id: string; label: string }[];

    test("connects an account for Studio and picks with it", async ({
      page,
      loginAndGoToProject,
      fakeGoogle,
      drivePicker,
    }) => {
      const account = fakeGoogle.newAccountId();
      await fakeGoogle.signInAs(account, { email: "team@church.example" });
      drivePicker.willPick(DECK);
      await loginAndGoToProject();

      const result = await pick(page, { mode: "connect" });
      expect(result).toMatchObject({
        presentationId: DECK.id,
        name: DECK.name,
      });
      expect(result.connectionId).toBeTruthy();
      expect(result.accessToken).toBeUndefined();

      expect(await accountsOf(page)).toEqual([
        expect.objectContaining({
          id: result.connectionId,
          label: "team@church.example",
        }),
      ]);

      // Studio imports with a token it asks the cloud for
      const token = await cloud(page).post("google/remote/token", {
        connectionId: result.connectionId,
      });
      expect(token.ok()).toBe(true);
      expect((await token.json()).accessToken).toMatch(/^access-/);

      const { signIns } = await fakeGoogle.activity(account);
      expect(signIns).toEqual([{ offline: true }]);
    });

    test("import once hands back a token and stores nothing", async ({
      page,
      loginAndGoToProject,
      fakeGoogle,
      drivePicker,
    }) => {
      const account = fakeGoogle.newAccountId();
      await fakeGoogle.signInAs(account, { email: "guest@church.example" });
      drivePicker.willPick(DECK);
      await loginAndGoToProject();

      const result = await pick(page, { mode: "once" });
      expect(result).toMatchObject({
        presentationId: DECK.id,
        connectionId: null,
      });
      // The token the picker ran with is the one Studio gets
      expect(result.accessToken).toMatch(/^access-/);
      expect(drivePicker.openedWithTokens.at(-1)).toBe(result.accessToken);

      expect(await accountsOf(page)).toEqual([]);
      // Nothing to keep, so no refresh token was asked for
      const { signIns } = await fakeGoogle.activity(account);
      expect(signIns).toEqual([{ offline: false }]);
    });

    test("picks with the account chosen in Studio, not just the latest", async ({
      page,
      loginAndGoToProject,
      fakeGoogle,
      drivePicker,
    }) => {
      const first = fakeGoogle.newAccountId("first");
      const second = fakeGoogle.newAccountId("second");
      drivePicker.willPick(DECK);
      await loginAndGoToProject();

      await fakeGoogle.signInAs(first, { email: "first@church.example" });
      const { connectionId: firstId } = await pick(page, { mode: "connect" });
      await fakeGoogle.signInAs(second, { email: "second@church.example" });
      const { connectionId: secondId } = await pick(page, { mode: "connect" });
      expect(firstId).not.toBe(secondId);

      const result = await pick(page, { mode: "pick", connectionId: firstId! });
      expect(result.connectionId).toBe(firstId);

      // The picker ran as the chosen account
      const token = await (
        await cloud(page).post("google/remote/token", { connectionId: firstId })
      ).json();
      expect(drivePicker.openedWithTokens.at(-1)).toBe(token.accessToken);
    });

    test("disconnects from Studio", async ({
      page,
      loginAndGoToProject,
      fakeGoogle,
      drivePicker,
    }) => {
      const account = fakeGoogle.newAccountId();
      await fakeGoogle.signInAs(account);
      drivePicker.willPick(DECK);
      await loginAndGoToProject();

      const { connectionId } = await pick(page, { mode: "connect" });
      const res = await cloud(page).post("google/remote/disconnect", {
        connectionId,
      });
      expect(res.status()).toBe(200);
      expect(await accountsOf(page)).toEqual([]);

      const again = await cloud(page).post("google/remote/disconnect", {
        connectionId,
      });
      expect(again.status()).toBe(404);
    });

    test("a cancelled import once is reported to Studio", async ({
      page,
      loginAndGoToProject,
      fakeGoogle,
    }) => {
      const account = fakeGoogle.newAccountId();
      await fakeGoogle.signInAs(account, { denyAuthorization: true });
      await loginAndGoToProject();

      const begin = await cloud(page).post("google/remote/pick", {
        mode: "once",
      });
      const { intentId, url } = await begin.json();
      const tab = await visitInBrowser(page, url);
      await expect(
        tab.getByText("Google sign-in was cancelled."),
      ).toBeVisible();

      const intent = (await (
        await cloud(page).get("google/remote/intent", { id: intentId })
      ).json()) as Intent<PickResult>;
      expect(intent.status).toBe("failed");
      expect(intent.error).toBe("Google sign-in was cancelled.");
    });
  });
});
