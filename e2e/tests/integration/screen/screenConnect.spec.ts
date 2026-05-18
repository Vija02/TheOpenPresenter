import { expect, test } from "../../../fixtures/screenFixture";
import { ConnectScreenPage } from "../../../pages/ConnectScreenPage";

const WORKER_TAG = `w${process.env.TEST_WORKER_INDEX ?? "0"}`;
const ORG_SLUG = `testorg-connect-${WORKER_TAG}`;
const SCREEN_SLUG = `testscreen-connect-${WORKER_TAG}`;
const ORG_NAME = `TestOrg Connect ${WORKER_TAG}`;
const USERNAME = `testuser_connect_${WORKER_TAG}`;

const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function mutateCode(code: string): string {
  const first = code[0];
  const replacement = CODE_ALPHABET.split("").find((c) => c !== first)!;
  return replacement + code.slice(1);
}

test.describe("Connect page", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ e2eCommand }) => {
    await e2eCommand.serverCommand("clearOrganizationBySlug", {
      slug: ORG_SLUG,
    });
    await e2eCommand.serverCommand("clearUserByUsername", {
      username: USERNAME,
    });
  });

  test("valid code (lowercase) redirects to the screen control page", async ({
    page,
    e2eCommand,
    setupScreen,
    screenControlPage,
  }) => {
    await e2eCommand.login({
      username: USERNAME,
      orgs: [{ name: ORG_NAME, slug: ORG_SLUG, owner: true }],
    });
    const ctx = await setupScreen({
      orgSlug: ORG_SLUG,
      slug: SCREEN_SLUG,
    });

    const connectPage = new ConnectScreenPage(page);
    await connectPage.goto();
    await expect(connectPage.heading).toBeVisible();
    // Typed in lowercase — the form uppercases on change and the DB column
    // is citext, so the lookup is case-insensitive end-to-end.
    await connectPage.enterCode(ctx.screenCode.toLowerCase());

    await expect(page).toHaveURL(
      new RegExp(`/o/${ctx.orgSlug}/screens/${ctx.screenSlug}/control`),
    );
    await expect(screenControlPage.pickProjectHeading).toBeVisible();
  });

  test("non-matching code shows 'No screen found' error", async ({
    page,
    e2eCommand,
    setupScreen,
  }) => {
    await e2eCommand.login({
      username: USERNAME,
      orgs: [{ name: ORG_NAME, slug: ORG_SLUG, owner: true }],
    });
    const ctx = await setupScreen({
      orgSlug: ORG_SLUG,
      slug: SCREEN_SLUG,
    });

    const connectPage = new ConnectScreenPage(page);
    await connectPage.goto();
    await connectPage.enterCode(mutateCode(ctx.screenCode));

    await expect(connectPage.fieldError).toBeVisible();
    await expect(page).toHaveURL(/\/connect$/);
  });
});
