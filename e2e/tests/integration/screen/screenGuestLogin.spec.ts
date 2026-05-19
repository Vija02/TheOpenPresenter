import { expect, test } from "../../../fixtures/screenFixture";

const WORKER_TAG = `w${process.env.TEST_WORKER_INDEX ?? "0"}`;
const ORG_SLUG = `testorg-guestlogin-${WORKER_TAG}`;
const SCREEN_SLUG = `testscreen-guestlogin-${WORKER_TAG}`;

test.describe("Screen guest login", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ e2eCommand }) => {
    await e2eCommand.serverCommand("clearOrganizationBySlug", {
      slug: ORG_SLUG,
    });
  });

  test("anonymous guest auto-claims control when policy is allow", async ({
    page,
    setupScreen,
    loginAsAnonGuest,
    screenControlPage,
  }) => {
    const ctx = await setupScreen({
      orgSlug: ORG_SLUG,
      slug: SCREEN_SLUG,
      anonEnabled: true,
      anonOnEmpty: "allow",
      registeredEnabled: false,
    });

    await loginAsAnonGuest(ctx, "Anon Tester");

    await expect(page).toHaveURL(
      new RegExp(`/o/${ctx.orgSlug}/screens/${ctx.screenSlug}/control`),
    );
    await expect(screenControlPage.openProjectHeading).toBeVisible();
  });

  test("registered guest signs in with passcode and reaches control", async ({
    page,
    setupScreen,
    setupScreenGuest,
    loginAsRegisteredGuest,
    screenControlPage,
  }) => {
    const ctx = await setupScreen({
      orgSlug: ORG_SLUG,
      slug: SCREEN_SLUG,
      anonEnabled: false,
      registeredEnabled: true,
      registeredOnEmpty: "allow",
    });
    const guest = await setupScreenGuest({
      orgSlug: ctx.orgSlug,
      passcode: "SecretPass1",
      email: "passcode-user@example.com",
    });

    await loginAsRegisteredGuest(ctx, guest.passcode);

    await expect(page).toHaveURL(
      new RegExp(`/o/${ctx.orgSlug}/screens/${ctx.screenSlug}/control`),
    );
    await expect(screenControlPage.openProjectHeading).toBeVisible();
  });

  test("registered guest signs in with email and reaches control", async ({
    page,
    setupScreen,
    setupScreenGuest,
    loginAsRegisteredGuest,
    screenControlPage,
  }) => {
    const ctx = await setupScreen({
      orgSlug: ORG_SLUG,
      slug: SCREEN_SLUG,
      anonEnabled: false,
      registeredEnabled: true,
      registeredOnEmpty: "allow",
    });
    const guest = await setupScreenGuest({
      orgSlug: ctx.orgSlug,
      passcode: "AnotherPass",
      email: "email-login@example.com",
    });

    await loginAsRegisteredGuest(ctx, guest.email!);

    await expect(page).toHaveURL(
      new RegExp(`/o/${ctx.orgSlug}/screens/${ctx.screenSlug}/control`),
    );
    await expect(screenControlPage.openProjectHeading).toBeVisible();
  });

  test("email match is case-insensitive", async ({
    page,
    setupScreen,
    setupScreenGuest,
    loginAsRegisteredGuest,
    screenControlPage,
  }) => {
    const ctx = await setupScreen({
      orgSlug: ORG_SLUG,
      slug: SCREEN_SLUG,
      anonEnabled: false,
      registeredEnabled: true,
      registeredOnEmpty: "allow",
    });
    const guest = await setupScreenGuest({
      orgSlug: ctx.orgSlug,
      email: "MixedCase@Example.com",
    });

    await loginAsRegisteredGuest(ctx, guest.email!.toUpperCase());

    await expect(page).toHaveURL(
      new RegExp(`/o/${ctx.orgSlug}/screens/${ctx.screenSlug}/control`),
    );
    await expect(screenControlPage.openProjectHeading).toBeVisible();
  });

  test("wrong passcode shows an error and stays on login", async ({
    page,
    setupScreen,
    setupScreenGuest,
    loginAsRegisteredGuest,
    screenLoginPage,
  }) => {
    const ctx = await setupScreen({
      orgSlug: ORG_SLUG,
      slug: SCREEN_SLUG,
      anonEnabled: false,
      registeredEnabled: true,
      registeredOnEmpty: "allow",
    });
    await setupScreenGuest({
      orgSlug: ctx.orgSlug,
      passcode: "CorrectPass",
      email: "real-guest@example.com",
    });

    await loginAsRegisteredGuest(ctx, "WrongPass");

    await expect(screenLoginPage.errorAlert).toBeVisible();
    await expect(page).toHaveURL(
      new RegExp(`/o/${ctx.orgSlug}/screens/${ctx.screenSlug}/login`),
    );
  });

  test("screen with both guest paths disabled shows 'Screen not available'", async ({
    page,
    setupScreen,
    screenLoginPage,
  }) => {
    const ctx = await setupScreen({
      orgSlug: ORG_SLUG,
      slug: SCREEN_SLUG,
      anonEnabled: false,
      registeredEnabled: false,
    });

    await screenLoginPage.goto(ctx.orgSlug, ctx.screenSlug);

    await expect(screenLoginPage.screenNotAvailableAlert).toBeVisible();
    await expect(screenLoginPage.heading).toBeHidden();
  });
});
