import { expect, test } from "../../fixtures/organizationFixture";
import { ORG_SLUG, orgUrl } from "../../helpers/workerData";
import { OrgSettingCategoriesPage } from "../../pages/OrgSettings/OrgSettingCategoriesPage";

const comingSunday = () => {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return d;
};

test.describe("Categories", () => {
  test.beforeEach(async ({ e2eCommand }) => await e2eCommand.clearWorkerData());

  test("schedule and default project shape new projects", async ({
    page,
    organizationPage,
    loginWithDefaultProject,
  }) => {
    await loginWithDefaultProject(`${orgUrl()}/settings/categories`);

    const select = async (field: string, option: string) => {
      // Unsearchable selects keep their input off-screen, so open by keyboard
      await page
        .getByTestId(`form-item-${field}`)
        .getByRole("combobox")
        .focus();
      await page.keyboard.press("ArrowDown");
      await page.getByRole("option", { name: option, exact: true }).click();
    };

    await page
      .getByRole("row", { name: /Sunday Morning/ })
      .getByRole("button", { name: "Edit category" })
      .click();
    await page.getByRole("tab", { name: "Schedule" }).click();
    await select("schedule", "Every Sunday");
    await page
      .getByRole("group", { name: "Starts at" })
      .getByRole("spinbutton")
      .first()
      .click();
    await page.keyboard.type("1030");
    await expect(page.getByText(/Every Sunday at 10:30\. Next:/)).toBeVisible();
    await page.getByRole("tab", { name: "Template" }).click();
    await select("templateProjectId", "TestProject");
    await page.getByRole("button", { name: "Save", exact: true }).click();

    const row = page.getByRole("row", { name: /Sunday Morning/ });
    await expect(row).toContainText("Every Sunday at 10:30");
    await expect(row).toContainText("TestProject");

    await page.goto(orgUrl());
    await expect(
      organizationPage.projectCards.getByText(
        "Default project for Sunday Morning",
      ),
    ).toBeVisible();

    await page
      .getByRole("button", { name: "Sunday Morning", exact: true })
      .click();
    await expect(page).toHaveURL(/category=/);
    await expect(
      page.getByText("No projects in this category yet."),
    ).toBeVisible();

    await organizationPage.newProjectButton.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByTestId("form-item-categoryId")).toContainText(
      "Sunday Morning",
    );
    await expect(dialog.getByTestId("form-item-targetDate")).toContainText(
      String(comingSunday().getDate()),
    );
    await expect(
      dialog.getByTestId("form-item-templateProjectId"),
    ).toContainText("TestProject");
    await expect(dialog.locator('input[name="targetTime"]')).toHaveValue(
      /^10:30/,
    );

    await organizationPage.newProjectSaveButton.click();
    await expect(page).toHaveURL(new RegExp(`/app/${ORG_SLUG}/`));

    await page.goto(orgUrl());
    await page
      .getByRole("button", { name: "Sunday Morning", exact: true })
      .click();
    await expect(organizationPage.projectCards).toHaveCount(1);
    await expect(organizationPage.projectCards).toContainText("10:30");
  });

  test("order shows on the projects page, with a dropdown on mobile", async ({
    page,
    organizationPage,
    loginWithDefaultProject,
  }) => {
    await loginWithDefaultProject(`${orgUrl()}/settings/categories`);
    const select = async (field: string, option: string) => {
      // Unsearchable selects keep their input off-screen, so open by keyboard
      await page
        .getByTestId(`form-item-${field}`)
        .getByRole("combobox")
        .focus();
      await page.keyboard.press("ArrowDown");
      await page.getByRole("option", { name: option, exact: true }).click();
    };

    await page.getByRole("button", { name: "Add Category" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("textbox", { name: "Name" })).toBeFocused();
    await dialog.getByRole("textbox", { name: "Name" }).fill("Youth");
    // Creating is step by step
    await expect(dialog.getByRole("tab", { name: /Template/ })).toBeDisabled();
    await dialog.getByRole("button", { name: "Next" }).click();
    // New categories start as every Sunday; Custom shows the full controls
    await expect(dialog.getByTestId("form-item-schedule")).toContainText(
      "Every Sunday",
    );
    await expect(dialog.getByRole("group", { name: "Repeat on" })).toBeHidden();
    await select("schedule", "Custom…");
    await dialog.getByRole("button", { name: "Saturday" }).click();
    await dialog.getByRole("button", { name: "Sunday" }).click();
    await expect(
      dialog.getByText("Every Saturday at 10:00. Next:"),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Next" }).click();
    await dialog.getByRole("button", { name: "Create", exact: true }).click();
    const youth = page.getByRole("row", { name: /Youth/ });
    await expect(youth).toContainText("Every Saturday");

    await expect(page.getByRole("dialog")).toBeHidden();
    const from = await page
      .getByRole("button", { name: "Reorder Youth" })
      .boundingBox();
    const to = await page
      .getByRole("button", { name: "Reorder Sunday Morning" })
      .boundingBox();
    await page.mouse.move(from!.x + 5, from!.y + 5);
    await page.mouse.down();
    // Nudge first so the drag starts, then move onto the target row
    await page.mouse.move(from!.x + 5, from!.y + 15, { steps: 3 });
    await page.mouse.move(to!.x + 5, to!.y, { steps: 20 });
    await page.waitForTimeout(100);
    await page.mouse.up();
    await expect(page.getByRole("row").nth(1)).toContainText("Youth");
    await page.reload();
    await expect(page.getByRole("row").nth(1)).toContainText("Youth");

    await page.goto(orgUrl());
    const pills = page.getByRole("group", { name: "Filter by category" });
    await expect(pills.getByRole("button")).toHaveText([
      "All",
      "Youth",
      "Sunday Morning",
      "Other",
    ]);

    await page.setViewportSize({ width: 390, height: 800 });
    await expect(pills).toBeHidden();
    await page.getByTestId("category-filter-select").click();
    await page.getByRole("option", { name: "Sunday Morning" }).click();
    await expect(page).toHaveURL(/category=/);
    await expect(
      page.getByText("No projects in this category yet."),
    ).toBeVisible();
    await expect(organizationPage.projectCards).toHaveCount(0);
  });

  test("a category can be hidden from the projects filter", async ({
    page,
    organizationPage,
    loginWithDefaultProject,
  }) => {
    await loginWithDefaultProject(`${orgUrl()}/settings/categories`);

    await page
      .getByRole("row", { name: /Sunday Morning/ })
      .getByRole("button", { name: "Edit category" })
      .click();
    await page.getByRole("checkbox", { name: /Show in filter/ }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByRole("row", { name: /Sunday Morning/ }),
    ).toContainText("Hidden from filter");

    await page.goto(orgUrl());
    const pills = page.getByRole("group", { name: "Filter by category" });
    await expect(pills.getByRole("button")).toHaveText(["All", "Other"]);

    // A link to a category that no longer exists shows everything
    await page.goto(
      `${orgUrl()}?category=00000000-0000-0000-0000-000000000000`,
    );
    await expect(pills.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(organizationPage.projectCards).toHaveCount(1);
  });

  test("the default category is picked for new projects", async ({
    page,
    organizationPage,
    loginWithDefaultProject,
  }) => {
    await loginWithDefaultProject(`${orgUrl()}/settings/categories`);

    await page
      .getByRole("row", { name: /Sunday Morning/ })
      .getByRole("button", { name: "Edit category" })
      .click();
    await page.getByRole("checkbox", { name: /Use as default/ }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByRole("row", { name: /Sunday Morning/ }),
    ).toContainText("Default");

    await page.goto(orgUrl());
    await organizationPage.newProjectButton.click();
    await expect(
      page.getByRole("dialog").getByTestId("form-item-categoryId"),
    ).toContainText("Sunday Morning");
    await page.keyboard.press("Escape");

    // Filtering by Other (no category) still starts uncategorized
    await page.getByRole("button", { name: "Other", exact: true }).click();
    await organizationPage.newProjectButton.click();
    await expect(
      page.getByRole("dialog").getByTestId("form-item-categoryId"),
    ).toContainText("Uncategorized");
  });

  test("a category without a name gets a numbered default", async ({
    page,
    loginWithDefaultProject,
  }) => {
    await loginWithDefaultProject(`${orgUrl()}/settings/categories`);
    const settings = new OrgSettingCategoriesPage(page);

    await settings.createCategory("");
    await expect(
      page.getByRole("row", { name: /Unnamed category/ }),
    ).toHaveCount(1);
    await settings.createCategory("");
    await expect(
      page.getByRole("row", { name: /Unnamed category 2/ }),
    ).toBeVisible();
  });
});
