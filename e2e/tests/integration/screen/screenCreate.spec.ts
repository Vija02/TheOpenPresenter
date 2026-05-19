import { expect, test } from "../../../fixtures/screenFixture";

const WORKER_TAG = `w${process.env.TEST_WORKER_INDEX ?? "0"}`;
const ORG_SLUG = `testorg-create-${WORKER_TAG}`;
const ORG_NAME = `TestOrg Create ${WORKER_TAG}`;
const USERNAME = `testuser_create_${WORKER_TAG}`;
const SCREEN_NAME = `Create Test Screen ${WORKER_TAG}`;
const SCREEN_SLUG = `testscreen-create-${WORKER_TAG}`;

test.describe("Create screen via UI", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ e2eCommand }) => {
    await e2eCommand.serverCommand("clearOrganizationBySlug", {
      slug: ORG_SLUG,
    });
    await e2eCommand.serverCommand("clearUserByUsername", {
      username: USERNAME,
    });
  });

  test("org owner creates a screen through the GraphQL mutation", async ({
    page,
    e2eCommand,
  }) => {
    await e2eCommand.login({
      username: USERNAME,
      orgs: [{ name: ORG_NAME, slug: ORG_SLUG, owner: true }],
      next: `/o/${ORG_SLUG}/screens`,
    });

    await expect(page).toHaveURL(new RegExp(`/o/${ORG_SLUG}/screens$`));
    await expect(
      page.getByRole("heading", { name: "Screens", exact: true }),
    ).toBeVisible();

    // Empty state: click the "New screen" button inside the empty placeholder.
    await page.getByRole("button", { name: "New screen" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "New Screen" }),
    ).toBeVisible();

    await dialog
      .getByTestId("form-item-name")
      .getByRole("textbox")
      .fill(SCREEN_NAME);
    await dialog
      .getByTestId("form-item-slug")
      .getByRole("textbox")
      .fill(SCREEN_SLUG);

    await dialog.getByRole("button", { name: "Create", exact: true }).click();

    await expect(dialog).toBeHidden();

    // New screen shows up in the list and links to its admin page.
    const screenLink = page.getByRole("link", {
      name: new RegExp(SCREEN_NAME),
    });
    await expect(screenLink).toBeVisible();
    await expect(screenLink).toHaveAttribute(
      "href",
      `/o/${ORG_SLUG}/screens/${SCREEN_SLUG}/admin`,
    );

    // Follow through to the admin page so we also confirm the row is readable
    await screenLink.click();
    await expect(page).toHaveURL(
      new RegExp(`/o/${ORG_SLUG}/screens/${SCREEN_SLUG}/admin`),
    );
  });

  test("slug auto-derives from name when left blank", async ({
    page,
    e2eCommand,
  }) => {
    await e2eCommand.login({
      username: USERNAME,
      orgs: [{ name: ORG_NAME, slug: ORG_SLUG, owner: true }],
      next: `/o/${ORG_SLUG}/screens`,
    });

    await page.getByRole("button", { name: "New screen" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Leave the slug input empty - the modal slugifies the name client-side.
    const derivedName = `Auto Slug ${WORKER_TAG}`;
    const expectedSlug = `auto-slug-${WORKER_TAG.toLowerCase()}`;
    await dialog
      .getByTestId("form-item-name")
      .getByRole("textbox")
      .fill(derivedName);

    await dialog.getByRole("button", { name: "Create", exact: true }).click();
    await expect(dialog).toBeHidden();

    const screenLink = page.getByRole("link", {
      name: new RegExp(derivedName),
    });
    await expect(screenLink).toBeVisible();
    await expect(screenLink).toHaveAttribute(
      "href",
      `/o/${ORG_SLUG}/screens/${expectedSlug}/admin`,
    );
  });
});
