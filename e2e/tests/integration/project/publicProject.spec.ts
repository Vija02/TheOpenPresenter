import { expect, test } from "../../../fixtures/projectFixture";

test.describe("Public Project", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
      ]),
  );

  test("can toggle a project public and open it from an unauthenticated browser", async ({
    page,
    browser,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();

    // Wait for the project metadata to load before interacting with the modal.
    const projectNameLocator = page.locator(".rt--top-bar--project-name");
    await expect(projectNameLocator).toContainText("TestProject");

    // First verify that without the toggle, an unauthenticated browser
    // is redirected away from the project.
    const privateContext = await browser.newContext();
    try {
      const privatePage = await privateContext.newPage();
      await privatePage.goto("/app/testorg/testproject");
      await privatePage.waitForURL(
        (url) => !/\/app\/testorg\/testproject/.test(url.pathname),
        { timeout: 10000 },
      );
      expect(privatePage.url()).not.toContain("/app/testorg/testproject");
    } finally {
      await privateContext.close();
    }

    // Open the project settings modal from the top bar.
    await projectNameLocator.click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Edit Project" }),
    ).toBeVisible();

    // Toggle the "Make project public" checkbox and save.
    await dialog.getByText("Make project public").click();
    await dialog.getByRole("button", { name: "Save" }).click();

    // The dialog should close after saving.
    await expect(
      dialog.getByRole("heading", { name: "Edit Project" }),
    ).not.toBeVisible();

    // Open the project in a fresh, unauthenticated browser context.
    const unauthContext = await browser.newContext();
    try {
      const unauthPage = await unauthContext.newPage();
      await unauthPage.goto("/app/testorg/testproject");

      // The remote should load the public project — not redirect to login.
      await expect(
        unauthPage.locator(".rt--top-bar--project-name"),
      ).toHaveText(/TestProject/);
      await expect(unauthPage).toHaveURL(/\/app\/testorg\/testproject/);
      await expect(
        unauthPage.getByRole("heading", { name: "Login" }),
      ).not.toBeVisible();
    } finally {
      await unauthContext.close();
    }
  });

  test("media picker hides upload UI and shows a notice when viewed publicly", async ({
    page,
    browser,
    projectPage,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();

    await projectPage.createPlugin("Video Player");
    await expect(page.getByText("Search or enter URL:")).toBeVisible();

    // Toggle the project public via the Edit Project dialog.
    const projectNameLocator = page.locator(".rt--top-bar--project-name");
    await expect(projectNameLocator).toContainText("TestProject");
    await projectNameLocator.click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Edit Project" }),
    ).toBeVisible();
    await dialog.getByText("Make project public").click();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(
      dialog.getByRole("heading", { name: "Edit Project" }),
    ).not.toBeVisible();

    // Open the project in an unauthenticated browser context and verify
    // the media picker enters its public-access state.
    const unauthContext = await browser.newContext();
    try {
      const unauthPage = await unauthContext.newPage();
      await unauthPage.goto("/app/testorg/testproject");

      // Wait for the public project Remote to render and the video
      // player plugin scene to mount.
      await expect(
        unauthPage.locator(".rt--top-bar--project-name"),
      ).toHaveText(/TestProject/);
      const mediaLibraryButton = unauthPage.getByRole("button", {
        name: "Media Library",
      });
      await expect(mediaLibraryButton).toBeVisible();

      // Open the media picker.
      await mediaLibraryButton.click();

      const pickerDialog = unauthPage.getByTestId("media-picker-dialog");
      await expect(pickerDialog).toBeVisible();

      // Public-access notice should be shown in the picker body.
      await expect(
        pickerDialog.getByTestId("media-picker-public-access-notice"),
      ).toBeVisible();

      // The Upload button in the picker header must not be rendered.
      await expect(
        pickerDialog.getByTestId("media-picker-upload-button"),
      ).toHaveCount(0);
      await expect(
        pickerDialog.getByText(
          /Sign in to browse and select media for this project/i,
        ),
      ).toBeVisible();

      // The Upload button in the picker header must not be rendered.
      await expect(
        pickerDialog.getByRole("button", { name: "Upload" }),
      ).toHaveCount(0);
    } finally {
      await unauthContext.close();
    }
  });
});
