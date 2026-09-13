import { Page, expect } from "@playwright/test";

/**
 * Locators and small flows shared by the onboarding specs. Kept here rather
 * than in a page object because onboarding is a single page whose steps swap
 * out in place, so there is no per-page class to hang them off.
 */

export const churchStep = (page: Page) =>
  page.getByTestId("onboarding-step-church");
export const inviteStep = (page: Page) =>
  page.getByTestId("onboarding-step-invite");

export const churchInput = (page: Page) =>
  page.getByTestId("onboarding-church-input");
export const churchCreateButton = (page: Page) =>
  page.getByTestId("onboarding-church-create");
export const churchPublicCheckbox = (page: Page) =>
  page.getByTestId("onboarding-church-public");
/** The skip sitting next to the create button. */
export const churchSkipInline = (page: Page) =>
  page.getByTestId("onboarding-church-skip-inline");
/** The skip at the bottom of the step. */
export const churchSkipBottom = (page: Page) =>
  page.getByTestId("onboarding-church-skip");
export const churchMatches = (page: Page) =>
  page.getByTestId("onboarding-church-match");
export const churchRequestButtons = (page: Page) =>
  page.getByTestId("onboarding-church-request");

export const inviteInput = (page: Page) =>
  page.getByTestId("onboarding-invite-input");
export const inviteSendButton = (page: Page) =>
  page.getByTestId("onboarding-invite-send");
export const inviteSent = (page: Page) =>
  page.getByTestId("onboarding-invite-sent");
export const inviteBackButton = (page: Page) =>
  page.getByTestId("onboarding-invite-back");
export const inviteSkipButton = (page: Page) =>
  page.getByTestId("onboarding-invite-skip");
export const inviteContinueButton = (page: Page) =>
  page.getByTestId("onboarding-invite-continue");

export const verifyStep = (page: Page) =>
  page.getByTestId("onboarding-step-verify");
export const verifyRecheckButton = (page: Page) =>
  page.getByTestId("onboarding-verify-recheck");
export const verifyNotYetMessage = (page: Page) =>
  page.getByTestId("onboarding-verify-not-yet");

/**
 * Types a name and creates the organization, leaving the page on the invite
 * step. Waiting for the invite step before returning means a caller can never
 * assert against a half-finished create.
 */
export const createOrganization = async (
  page: Page,
  name: string,
  options: { isPublic?: boolean } = {},
) => {
  await expect(churchStep(page)).toBeVisible();
  await churchInput(page).fill(name);

  if (options.isPublic === false) {
    await churchPublicCheckbox(page).click();
    await expect(churchPublicCheckbox(page)).toHaveAttribute(
      "data-state",
      "unchecked",
    );
  }

  await churchCreateButton(page).click();
  await expect(inviteStep(page)).toBeVisible();
};
