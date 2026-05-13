import { expect, test } from "../../../fixtures/screenFixture";
import { ScreenAdminPage } from "../../../pages/ScreenGuest/ScreenAdminPage";

const WORKER_TAG = `w${process.env.TEST_WORKER_INDEX ?? "0"}`;
const ORG_SLUG = `testorg-policy-${WORKER_TAG}`;
const SCREEN_SLUG = `testscreen-policy-${WORKER_TAG}`;
const ORG_NAME = `TestOrg Policy ${WORKER_TAG}`;

test.describe("Screen control policy", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ e2eCommand }) => {
    await e2eCommand.serverCommand("clearOrganizationBySlug", {
      slug: ORG_SLUG,
    });
  });

  test("anon guest: admin approves -> guest is granted control", async ({
    page,
    setupOrgOwnerContext,
    setupScreen,
    loginAsAnonGuest,
    screenRequestPage,
    screenControlPage,
  }) => {
    const owner = await setupOrgOwnerContext({
      orgSlug: ORG_SLUG,
      orgName: ORG_NAME,
    });
    const ctx = await setupScreen({
      orgSlug: ORG_SLUG,
      slug: SCREEN_SLUG,
      anonEnabled: true,
      anonOnEmpty: "request",
      registeredEnabled: false,
    });

    const adminScreenPage = new ScreenAdminPage(owner.page);
    await adminScreenPage.goto(ctx.orgSlug, ctx.screenSlug);
    await expect(adminScreenPage.pendingPanelHeading).toBeHidden();

    await loginAsAnonGuest(ctx, "Approve Anon");
    await screenRequestPage.requestControlButton.click();
    await expect(screenRequestPage.waitingForApprovalAlert).toBeVisible();

    await expect(adminScreenPage.pendingPanelHeading).toBeVisible();
    await adminScreenPage.approveButton.click();

    await expect(page).toHaveURL(
      new RegExp(`/o/${ctx.orgSlug}/screens/${ctx.screenSlug}/control`),
    );
    await expect(screenControlPage.pickProjectHeading).toBeVisible();
    await expect(adminScreenPage.pendingPanelHeading).toBeHidden();
  });

  test("anon guest: admin denies -> guest sees 'denied' error", async ({
    page,
    setupOrgOwnerContext,
    setupScreen,
    loginAsAnonGuest,
    screenRequestPage,
  }) => {
    const owner = await setupOrgOwnerContext({
      orgSlug: ORG_SLUG,
      orgName: ORG_NAME,
    });
    const ctx = await setupScreen({
      orgSlug: ORG_SLUG,
      slug: SCREEN_SLUG,
      anonEnabled: true,
      anonOnEmpty: "request",
      registeredEnabled: false,
    });

    const adminScreenPage = new ScreenAdminPage(owner.page);
    await adminScreenPage.goto(ctx.orgSlug, ctx.screenSlug);

    await loginAsAnonGuest(ctx, "Deny Anon");
    await screenRequestPage.requestControlButton.click();
    await expect(screenRequestPage.waitingForApprovalAlert).toBeVisible();

    await expect(adminScreenPage.pendingPanelHeading).toBeVisible();
    await adminScreenPage.denyButton.click();

    await expect(screenRequestPage.requestDeniedError).toBeVisible();
    await expect(page).toHaveURL(
      new RegExp(`/o/${ctx.orgSlug}/screens/${ctx.screenSlug}/request`),
    );
  });

  test("registered guest: admin approves -> guest is granted control", async ({
    page,
    setupOrgOwnerContext,
    setupScreen,
    setupScreenGuest,
    loginAsRegisteredGuest,
    screenRequestPage,
    screenControlPage,
  }) => {
    const owner = await setupOrgOwnerContext({
      orgSlug: ORG_SLUG,
      orgName: ORG_NAME,
    });
    const ctx = await setupScreen({
      orgSlug: ORG_SLUG,
      slug: SCREEN_SLUG,
      anonEnabled: false,
      registeredEnabled: true,
      registeredOnEmpty: "request",
    });

    const adminScreenPage = new ScreenAdminPage(owner.page);
    await adminScreenPage.goto(ctx.orgSlug, ctx.screenSlug);

    const guest = await setupScreenGuest({
      orgSlug: ctx.orgSlug,
      displayName: "Approve Registered",
      passcode: "ApprovePass1",
      email: "approve-registered@example.com",
    });
    await loginAsRegisteredGuest(ctx, guest.passcode);

    await screenRequestPage.requestControlButton.click();
    await expect(screenRequestPage.waitingForApprovalAlert).toBeVisible();

    await expect(adminScreenPage.pendingPanelHeading).toBeVisible();
    await adminScreenPage.approveButton.click();

    await expect(page).toHaveURL(
      new RegExp(`/o/${ctx.orgSlug}/screens/${ctx.screenSlug}/control`),
    );
    await expect(screenControlPage.pickProjectHeading).toBeVisible();
    await expect(adminScreenPage.pendingPanelHeading).toBeHidden();
  });

  test("registered guest: admin denies -> guest sees 'denied' error", async ({
    page,
    setupOrgOwnerContext,
    setupScreen,
    setupScreenGuest,
    loginAsRegisteredGuest,
    screenRequestPage,
  }) => {
    const owner = await setupOrgOwnerContext({
      orgSlug: ORG_SLUG,
      orgName: ORG_NAME,
    });
    const ctx = await setupScreen({
      orgSlug: ORG_SLUG,
      slug: SCREEN_SLUG,
      anonEnabled: false,
      registeredEnabled: true,
      registeredOnEmpty: "request",
    });

    const adminScreenPage = new ScreenAdminPage(owner.page);
    await adminScreenPage.goto(ctx.orgSlug, ctx.screenSlug);

    const guest = await setupScreenGuest({
      orgSlug: ctx.orgSlug,
      displayName: "Deny Registered",
      passcode: "DenyPass1",
      email: "deny-registered@example.com",
    });
    await loginAsRegisteredGuest(ctx, guest.passcode);

    await screenRequestPage.requestControlButton.click();
    await expect(screenRequestPage.waitingForApprovalAlert).toBeVisible();

    await expect(adminScreenPage.pendingPanelHeading).toBeVisible();
    await adminScreenPage.denyButton.click();

    await expect(screenRequestPage.requestDeniedError).toBeVisible();
    await expect(page).toHaveURL(
      new RegExp(`/o/${ctx.orgSlug}/screens/${ctx.screenSlug}/request`),
    );
  });
});
