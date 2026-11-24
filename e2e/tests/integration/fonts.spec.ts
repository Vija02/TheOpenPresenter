import { expect, test } from "../../fixtures/organizationFixture";
import { orgUrl } from "../../helpers/workerData";

test.describe("Fonts", () => {
  test.beforeEach(async ({ e2eCommand }) => await e2eCommand.clearWorkerData());

  test("lists the built in and system fonts", async ({
    page,
    loginDefault,
  }) => {
    await loginDefault(`${orgUrl()}/settings/general`);

    await page.getByRole("link", { name: "Fonts", exact: true }).click();
    await expect(page).toHaveURL(/\/settings\/fonts$/);
    await expect(
      page.getByRole("heading", { name: "Fonts", level: 1 }),
    ).toBeVisible();

    await expect(page.getByText("Nothing added yet.")).toBeVisible();

    const builtIn = page.locator("section", {
      has: page.getByRole("heading", { name: "Built in" }),
    });
    await expect(builtIn.getByText("Inter", { exact: true })).toBeVisible();
    await expect(builtIn.getByText("Oswald", { exact: true })).toBeVisible();

    const system = page.locator("section", {
      has: page.getByRole("heading", { name: "System" }),
    });
    await expect(system.getByText("Arial", { exact: true })).toBeVisible();

    // Search narrows every section
    await page.getByPlaceholder("Search fonts").fill("oswald");
    await expect(builtIn.getByText("Oswald", { exact: true })).toBeVisible();
    await expect(builtIn.getByText("Inter", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "System" })).toHaveCount(0);
  });
});
