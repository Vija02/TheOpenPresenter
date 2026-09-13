import { TestInfo, expect, test } from "@playwright/test";

import { E2ECommandAPI } from "../../e2eCommand";
import {
  churchCreateButton,
  churchInput,
  churchMatches,
  churchRequestButtons,
  churchSkipBottom,
  churchSkipInline,
  churchStep,
  createOrganization,
  inviteBackButton,
  inviteContinueButton,
  inviteInput,
  inviteSendButton,
  inviteSent,
  inviteSkipButton,
  inviteStep,
  verifyNotYetMessage,
  verifyRecheckButton,
  verifyStep,
} from "../../helpers/onboarding";

/**
 * Onboarding runs after registration, so every spec here starts from a
 * verified user who owns no organization: that is the only state that lands on
 * /onboarding rather than being redirected away from it.
 */
test.describe("Onboarding", () => {
  /**
   * Every identity and organization is scoped to the test that made it, so
   * workers running in parallel can't delete each other's users mid-flow.
   * `testuser`/`test` prefixes keep them inside the reach of the existing
   * cleanup commands.
   *
   * Kept short on purpose: `users_username_check` caps usernames at 24
   * characters and allows letters and digits only, and an over-long name fails
   * the seed login rather than the assertion, which is a confusing way to find
   * out.
   */
  const scope = (testInfo: TestInfo) =>
    `${testInfo.workerIndex}${testInfo.title.replace(/[^a-z]/gi, "").slice(-8)}`.toLowerCase();

  const usernameFor = (testInfo: TestInfo) => `testuserob${scope(testInfo)}`;
  const seedUsernameFor = (testInfo: TestInfo) =>
    `testusersd${scope(testInfo)}`;
  /** Returns both the display name and the slug the app will derive from it. */
  const orgFor = (testInfo: TestInfo, suffix: string) => {
    const name = `Testob ${scope(testInfo)} ${suffix}`;
    return {
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
    };
  };

  /** A verified user with no organization, parked on /onboarding. */
  const startOnboarding = async (
    e2eCommand: E2ECommandAPI,
    testInfo: TestInfo,
    options: { verified?: boolean } = {},
  ) => {
    await e2eCommand.login({
      username: usernameFor(testInfo),
      verified: options.verified ?? true,
      orgs: [],
      next: "/onboarding",
    });
  };

  test.afterEach(async ({ page, request }, testInfo) => {
    const e2eCommand = new E2ECommandAPI(page, request);
    // Tear down only what this test made. A crashed run must not leave residue
    // for the next one, and a global sweep would pull the rug from under the
    // other workers. Organizations go first: a deleted owner leaves a public
    // org behind, which would then turn up in another spec's search results.
    await e2eCommand
      .serverCommand("clearOrganizationsBySlugPrefix", {
        prefix: orgFor(testInfo, "").slug,
      })
      .catch(() => {});
    for (const username of [usernameFor(testInfo), seedUsernameFor(testInfo)]) {
      await e2eCommand
        .serverCommand("clearUserByUsername", { username })
        .catch(() => {});
    }
  });

  test("sends a user with no organization into onboarding", async ({
    page,
    request,
  }, testInfo) => {
    const e2eCommand = new E2ECommandAPI(page, request);
    // Land on /o/ rather than /onboarding, so the redirect itself is what's
    // under test.
    await e2eCommand.login({
      username: usernameFor(testInfo),
      verified: true,
      orgs: [],
      next: "/o/",
    });

    await page.waitForURL(/\/onboarding/);
    await expect(churchStep(page)).toBeVisible();
  });

  test("blocks an unverified user until they verify", async ({
    page,
    request,
  }, testInfo) => {
    const e2eCommand = new E2ECommandAPI(page, request);
    await startOnboarding(e2eCommand, testInfo, { verified: false });

    await expect(
      page.getByRole("heading", { name: "Verify your email" }),
    ).toBeVisible();
    // The church step must not be reachable: joining an organization requires
    // a verified address, so everything downstream would fail.
    await expect(churchStep(page)).toHaveCount(0);
  });

  test("says so when the user hasn't actually verified yet", async ({
    page,
    request,
  }, testInfo) => {
    const e2eCommand = new E2ECommandAPI(page, request);
    await startOnboarding(e2eCommand, testInfo, { verified: false });

    await expect(verifyStep(page)).toBeVisible();
    await expect(verifyNotYetMessage(page)).toHaveCount(0);

    await verifyRecheckButton(page).click();

    // The whole point: a failed check has to look different from nothing
    // happening, and must not advance the flow.
    await expect(verifyNotYetMessage(page)).toBeVisible();
    await expect(verifyStep(page)).toBeVisible();
    await expect(churchStep(page)).toHaveCount(0);
  });

  test("offers to create as soon as a name is typed", async ({
    page,
    request,
  }, testInfo) => {
    const e2eCommand = new E2ECommandAPI(page, request);
    await startOnboarding(e2eCommand, testInfo);

    await expect(churchStep(page)).toBeVisible();
    // Nothing typed yet, so there is nothing to create.
    await expect(churchCreateButton(page)).toHaveCount(0);

    const org = orgFor(testInfo, "instant");
    await churchInput(page).fill(org.name);

    // Deliberately no waiting: the button must not be gated on the search
    // query coming back. The label is title-cased by the app, so match
    // case-insensitively rather than restating that rule here.
    await expect(churchCreateButton(page)).toBeVisible();
    await expect(churchCreateButton(page)).toHaveText(
      new RegExp(org.name, "i"),
    );
  });

  test("creates an organization, invites someone, then lands on the dashboard", async ({
    page,
    request,
  }, testInfo) => {
    const e2eCommand = new E2ECommandAPI(page, request);
    await startOnboarding(e2eCommand, testInfo);

    const org = orgFor(testInfo, "create");
    await createOrganization(page, org.name);

    await expect(
      page.getByRole("heading", { name: "Invite your team" }),
    ).toBeVisible();

    await inviteInput(page).fill("testuser_other@example.com");
    await inviteSendButton(page).click();
    await expect(inviteSent(page)).toHaveText(/testuser_other@example.com/);

    await inviteContinueButton(page).click();

    await page.waitForURL(new RegExp(`/o/${org.slug}`));
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  });

  test("invite step can go back to the church step", async ({
    page,
    request,
  }, testInfo) => {
    const e2eCommand = new E2ECommandAPI(page, request);
    await startOnboarding(e2eCommand, testInfo);

    await createOrganization(page, orgFor(testInfo, "back").name);

    await inviteBackButton(page).click();

    await expect(churchStep(page)).toBeVisible();
    await expect(inviteStep(page)).toHaveCount(0);
  });

  test("skipping the invite step still finishes onboarding", async ({
    page,
    request,
  }, testInfo) => {
    const e2eCommand = new E2ECommandAPI(page, request);
    await startOnboarding(e2eCommand, testInfo);

    const org = orgFor(testInfo, "inviteskip");
    await createOrganization(page, org.name);

    await inviteSkipButton(page).click();

    await page.waitForURL(new RegExp(`/o/${org.slug}`));
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  });

  test("finished onboarding is not shown again", async ({
    page,
    request,
  }, testInfo) => {
    const e2eCommand = new E2ECommandAPI(page, request);
    await startOnboarding(e2eCommand, testInfo);

    const org = orgFor(testInfo, "once");
    await createOrganization(page, org.name);
    await inviteSkipButton(page).click();
    await page.waitForURL(new RegExp(`/o/${org.slug}`));

    // Going back in deliberately: a user who already finished must be bounced
    // to their dashboard rather than asked the questions again.
    await page.goto("/onboarding");

    await page.waitForURL(new RegExp(`/o/${org.slug}`));
    await expect(churchStep(page)).toHaveCount(0);
  });

  test.describe("Skipping the church step", () => {
    // Both skip buttons run the same handler, so both must land on the
    // dashboard rather than the invite step: a personal space has no team to
    // invite anyone to.
    for (const [label, locator] of [
      ["next to create", churchSkipInline],
      ["at the bottom", churchSkipBottom],
    ] as const) {
      test(`skip ${label} goes straight to the dashboard`, async ({
        page,
        request,
      }, testInfo) => {
        const e2eCommand = new E2ECommandAPI(page, request);
        await startOnboarding(e2eCommand, testInfo);

        await expect(churchStep(page)).toBeVisible();
        if (locator === churchSkipInline) {
          // The inline skip only exists alongside the create button.
          await churchInput(page).fill(orgFor(testInfo, "unused").name);
        }

        await locator(page).click();

        // The personal space is named after the user.
        await page.waitForURL(new RegExp(`/o/${usernameFor(testInfo)}-space-`));
        await expect(
          page.getByRole("heading", { name: "Projects" }),
        ).toBeVisible();
        await expect(inviteStep(page)).toHaveCount(0);
      });
    }
  });

  test("unchecking public creates an invite-only organization", async ({
    page,
    request,
  }, testInfo) => {
    const e2eCommand = new E2ECommandAPI(page, request);
    await startOnboarding(e2eCommand, testInfo);

    const org = orgFor(testInfo, "private");
    await createOrganization(page, org.name, { isPublic: false });
    await inviteSkipButton(page).click();
    await page.waitForURL(new RegExp(`/o/${org.slug}`));

    // The settings page reads is_public straight off the row, so this fails if
    // the checkbox was ignored and the org was created public.
    await page.goto(`/o/${org.slug}/settings/general`);
    const publicCheckbox = page
      .getByTestId("form-item-isPublic")
      .getByRole("checkbox");
    await expect(publicCheckbox).toHaveAttribute("data-state", "unchecked");
  });

  test("leaving public checked creates a searchable organization", async ({
    page,
    request,
  }, testInfo) => {
    const e2eCommand = new E2ECommandAPI(page, request);
    await startOnboarding(e2eCommand, testInfo);

    const org = orgFor(testInfo, "public");
    await createOrganization(page, org.name);
    await inviteSkipButton(page).click();
    await page.waitForURL(new RegExp(`/o/${org.slug}`));

    await page.goto(`/o/${org.slug}/settings/general`);
    const publicCheckbox = page
      .getByTestId("form-item-isPublic")
      .getByRole("checkbox");
    await expect(publicCheckbox).toHaveAttribute("data-state", "checked");
  });

  test("finds an existing church and requests to join it", async ({
    page,
    request,
  }, testInfo) => {
    const e2eCommand = new E2ECommandAPI(page, request);
    const seeded = orgFor(testInfo, "grace");
    // Someone else's church, public so it turns up in search.
    await e2eCommand.login({
      username: seedUsernameFor(testInfo),
      verified: true,
      orgs: [
        {
          name: seeded.name,
          slug: seeded.slug,
          isPublic: true,
        },
      ],
      next: "/",
    });

    await startOnboarding(e2eCommand, testInfo);

    await churchInput(page).fill(seeded.name);

    await expect(churchMatches(page)).toHaveCount(1);
    await expect(churchMatches(page).first()).toHaveText(
      new RegExp(seeded.name, "i"),
    );

    await churchRequestButtons(page).first().click();

    await expect(page.getByTestId("onboarding-church-requested")).toBeVisible();
    await expect(
      page.getByText(new RegExp(`Request sent to ${seeded.name}`, "i")),
    ).toBeVisible();
    // Requests are one way, so the row stays marked.
    await expect(churchRequestButtons(page).first()).toContainText("Requested");
    // Asking to join doesn't hand them an organization, so the flow stays put.
    await expect(churchStep(page)).toBeVisible();
  });

  test("private organizations are not offered to join", async ({
    page,
    request,
  }, testInfo) => {
    const e2eCommand = new E2ECommandAPI(page, request);
    const seeded = orgFor(testInfo, "hidden");
    await e2eCommand.login({
      username: seedUsernameFor(testInfo),
      verified: true,
      orgs: [
        {
          name: seeded.name,
          slug: seeded.slug,
          isPublic: false,
        },
      ],
      next: "/",
    });

    await startOnboarding(e2eCommand, testInfo);

    await churchInput(page).fill(seeded.name);

    // The create button proves the search ran and the results are on screen;
    // without it this assertion would pass while the page was still blank.
    await expect(churchCreateButton(page)).toBeVisible();
    await expect(churchMatches(page)).toHaveCount(0);
  });

  test("paginates the existing churches list", async ({
    page,
    request,
  }, testInfo) => {
    const e2eCommand = new E2ECommandAPI(page, request);
    const seeded = orgFor(testInfo, "paged");
    // Seven matches against a page size of five, so there are exactly two
    // pages and the second one is short.
    await e2eCommand.login({
      username: seedUsernameFor(testInfo),
      verified: true,
      orgs: Array.from({ length: 7 }, (_, i) => ({
        name: `${seeded.name} ${i + 1}`,
        slug: `${seeded.slug}-${i + 1}`,
        isPublic: true,
      })),
      next: "/",
    });

    await startOnboarding(e2eCommand, testInfo);

    await churchInput(page).fill(seeded.name);

    await expect(churchMatches(page)).toHaveCount(5);

    const nextPage = page.locator(".ui--pagination-nav-link").last();
    await expect(nextPage).toBeVisible();
    await nextPage.click();

    await expect(churchMatches(page)).toHaveCount(2);

    // A fresh search must reset to the first page, otherwise the stale offset
    // returns nothing.
    await churchInput(page).fill(`${seeded.name} `);
    await expect(churchMatches(page)).toHaveCount(5);
  });
});
