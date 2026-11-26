import { expect, test } from "../../fixtures/organizationFixture";
import { ORG_SLUG, orgUrl } from "../../helpers/workerData";
import {
  OrgSettingCategoriesPage,
  categoryCard,
  categoryOption,
} from "../../pages/OrgSettings/OrgSettingCategoriesPage";

const comingSunday = (weeksLater = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7) + weeksLater * 7);
  return d;
};

/** As the new project summary shows it, e.g. "Sun 29 Nov" */
const shortDate = (d: Date) =>
  `${d.toLocaleDateString("en-GB", { weekday: "short" })} ${d.getDate()} ${d.toLocaleDateString("en-GB", { month: "short" })}`;

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

    await categoryCard(page, "Sunday Morning")
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
    await expect(
      page.getByText(/Every Sunday at 10:30 AM\. Next:/),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Template" }).click();
    await select("templateProjectId", "TestProject");
    await page.getByRole("button", { name: "Save", exact: true }).click();

    const row = categoryCard(page, "Sunday Morning");
    await expect(row).toContainText("Every Sunday at 10:30 AM");
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
    await expect(categoryOption(dialog, "Sunday Morning")).toBeChecked();
    // What the category filled in shows as one line, until Change
    await expect(dialog.getByTestId("create-project-summary")).toContainText(
      "at 10:30 AM",
    );
    await dialog.getByRole("button", { name: "Change" }).click();
    await expect(dialog.getByTestId("form-item-targetDate")).toContainText(
      String(comingSunday().getDate()),
    );
    await expect(dialog.locator('input[name="targetTime"]')).toHaveValue(
      /^10:30/,
    );

    await organizationPage.newProjectCreateButton.click();
    await expect(page).toHaveURL(new RegExp(`/app/${ORG_SLUG}/`));

    await page.goto(orgUrl());
    await page
      .getByRole("button", { name: "Sunday Morning", exact: true })
      .click();
    await expect(organizationPage.projectCards).toHaveCount(1);
    await expect(organizationPage.projectCards).toContainText("10:30 AM");
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
      dialog.getByText("Every Saturday at 10:00 AM. Next:"),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Next" }).click();
    await dialog.getByRole("button", { name: "Create", exact: true }).click();
    const youth = categoryCard(page, "Youth");
    await expect(youth).toContainText("Every Saturday");

    await expect(page.getByRole("dialog")).toBeHidden();
    // Rows above the fold would scroll mid-drag and move the drop target
    await page.evaluate(() => window.scrollTo(0, 0));
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
    await expect(categoryCard(page).first()).toContainText("Youth");
    await page.reload();
    await expect(categoryCard(page).first()).toContainText("Youth");

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
    // Wait for the switch to the native select after resizing
    const filter = page.getByRole("combobox", { name: "Filter by category" });
    await expect(filter).toHaveJSProperty("tagName", "SELECT");
    await filter.selectOption({ label: "Sunday Morning" });
    await expect(page).toHaveURL(/category=/);
    await expect(
      page.getByText("No projects in this category yet."),
    ).toBeVisible();
    await expect(organizationPage.projectCards).toHaveCount(0);
  });

  test("create another keeps the dialog open for the next date", async ({
    page,
    organizationPage,
    loginWithDefaultProject,
  }) => {
    await loginWithDefaultProject(`${orgUrl()}/settings/categories`);

    await categoryCard(page, "Sunday Morning")
      .getByRole("button", { name: "Edit category" })
      .click();
    await page.getByRole("tab", { name: "Schedule" }).click();
    await page.getByTestId("form-item-schedule").getByRole("combobox").focus();
    await page.keyboard.press("ArrowDown");
    await page
      .getByRole("option", { name: "Every Sunday", exact: true })
      .click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(categoryCard(page, "Sunday Morning")).toContainText(
      "Every Sunday",
    );

    await page.goto(orgUrl());
    await page
      .getByRole("button", { name: "Sunday Morning", exact: true })
      .click();
    await organizationPage.newProjectButton.click();
    const dialog = page.getByRole("dialog");
    const summary = dialog.getByTestId("create-project-summary");
    await expect(summary).toContainText(shortDate(comingSunday()));

    await dialog.getByRole("textbox", { name: "Name" }).fill("First");
    await dialog.getByRole("button", { name: "Create another" }).click();

    await expect(page.getByText("Created First")).toBeVisible();
    // Ready for the next one: name cleared, moved on a week
    await expect(dialog.getByRole("textbox", { name: "Name" })).toHaveValue("");
    await expect(summary).toContainText(shortDate(comingSunday(1)));
    await expect(page).not.toHaveURL(/\/app\//);

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(organizationPage.projectCards).toHaveCount(1);
    await expect(organizationPage.projectCards).toContainText("First");
  });

  test("on phones the date and tags avoid dropdowns", async ({
    page,
    organizationPage,
    loginWithDefaultProject,
  }) => {
    await loginWithDefaultProject(orgUrl());
    await page.setViewportSize({ width: 390, height: 800 });

    await organizationPage.newProjectButton.click();
    const dialog = page.getByRole("dialog", { name: "New Project" });
    // The phone's own picker for the category too
    const category = dialog.getByRole("combobox", { name: "Category" });
    await category.selectOption({ label: "Other" });
    await expect(category.locator("option:checked")).toHaveText("Other");

    // The phone's own date and time pickers
    await dialog.locator('input[type="date"]').fill("2030-12-25");
    await dialog.locator('input[type="time"]').fill("18:45");
    await expect(dialog.locator('input[name="targetTime"]')).toHaveValue(
      "18:45",
    );
    await expect(dialog.getByRole("textbox", { name: "Name" })).toHaveAttribute(
      "placeholder",
      "25th Dec 2030",
    );

    // Tags are picked from a card of rows; a new one is selected straight away
    await dialog.getByRole("button", { name: "Add tags" }).click();
    const tagPicker = page.getByRole("dialog", { name: "Tags" });
    // Stacked on New Project, which gets dimmed by a second backdrop
    await expect(page.locator('[data-slot="dialog-backdrop"]')).toHaveCount(2);
    const tagSettings = tagPicker.getByRole("link", { name: "Tag settings" });
    await expect(tagSettings).toHaveAttribute("href", /\/settings\/tags$/);
    await expect(tagSettings).toHaveAttribute("target", "_blank");
    await tagPicker
      .getByRole("textbox", { name: "Search or create a tag" })
      .fill("Mobile tag");
    await tagPicker
      .getByRole("button", { name: /Create “Mobile tag”/ })
      .click();
    const row = tagPicker.getByRole("checkbox", { name: "Mobile tag" });
    await expect(row).toBeChecked();
    // Tapping a row toggles it
    await row.click();
    await expect(row).not.toBeChecked();
    await row.click();
    await expect(row).toBeChecked();

    // Back closes only the tag picker
    await page.goBack();
    await expect(tagPicker).toBeHidden();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Mobile tag")).toBeVisible();

    await organizationPage.newProjectCreateButton.click();
    await expect(page).toHaveURL(new RegExp(`/app/${ORG_SLUG}/`));
  });

  test("on phones the back button closes the dialog first", async ({
    page,
    organizationPage,
    loginWithDefaultProject,
  }) => {
    await loginWithDefaultProject(orgUrl());
    await page.setViewportSize({ width: 390, height: 800 });
    const url = page.url();

    await organizationPage.newProjectButton.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("dialog")).toBeHidden();
    expect(page.url()).toBe(url);

    // Closing it another way doesn't leave an extra step for back
    await organizationPage.newProjectButton.click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel" })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect
      .poll(() => page.evaluate(() => window.history.state?.__overlay))
      .toBeUndefined();
    expect(page.url()).toBe(url);
  });

  test("on phones a tap outside puts the keyboard away first", async ({
    page,
    organizationPage,
    loginWithDefaultProject,
  }) => {
    await loginWithDefaultProject(orgUrl());
    await page.setViewportSize({ width: 390, height: 800 });

    await organizationPage.newProjectButton.click();
    const dialog = page.getByRole("dialog", { name: "New Project" });
    const name = dialog.getByRole("textbox", { name: "Name" });
    await name.fill("Half typed");

    // The sheet sits at the bottom; the top of the screen is backdrop
    await page.mouse.click(195, 20);
    await expect(name).not.toBeFocused();
    await expect(dialog).toBeVisible();

    await page.mouse.click(195, 20);
    await expect(dialog).toBeHidden();
  });

  test("a category can be hidden from the projects filter", async ({
    page,
    organizationPage,
    loginWithDefaultProject,
  }) => {
    await loginWithDefaultProject(`${orgUrl()}/settings/categories`);

    await categoryCard(page, "Sunday Morning")
      .getByRole("button", { name: "Edit category" })
      .click();
    await page.getByRole("checkbox", { name: /Show in filter/ }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(categoryCard(page, "Sunday Morning")).toContainText(
      "Hidden from filter",
    );

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

    await categoryCard(page, "Sunday Morning")
      .getByRole("button", { name: "Edit category" })
      .click();
    await page.getByRole("checkbox", { name: /Use as default/ }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      categoryCard(page, "Sunday Morning").getByText("Default", {
        exact: true,
      }),
    ).toBeVisible();

    await page.goto(orgUrl());
    await organizationPage.newProjectButton.click();
    const dialog = page.getByRole("dialog");
    await expect(categoryOption(dialog, "Sunday Morning")).toBeChecked();
    await categoryOption(dialog, "Other").click();
    await expect(categoryOption(dialog, "Other")).toBeChecked();
    await expect(categoryOption(dialog, "Sunday Morning")).not.toBeChecked();
    await page.keyboard.press("Escape");

    // Filtering by Other (no category) still starts uncategorized
    await page.getByRole("button", { name: "Other", exact: true }).click();
    await organizationPage.newProjectButton.click();
    await expect(
      categoryOption(page.getByRole("dialog"), "Other"),
    ).toBeChecked();
  });

  test("deleting a category keeps its projects", async ({
    page,
    organizationPage,
    loginWithDefaultProject,
  }) => {
    await loginWithDefaultProject(`${orgUrl()}/settings/categories`);
    const settings = new OrgSettingCategoriesPage(page);

    await settings.editExistingCategoryButton("Sunday Morning").click();
    await settings.deleteTab.click();
    await settings.deleteCategoryButton.click();
    await page.getByTestId("popconfirm-confirm").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(categoryCard(page, "Sunday Morning")).toHaveCount(0);

    await page.goto(orgUrl());
    await expect(organizationPage.projectCards).toHaveCount(1);
    await expect(organizationPage.projectCards).not.toContainText(
      "Sunday Morning",
    );
    await page.getByRole("button", { name: "Other", exact: true }).click();
    await expect(organizationPage.projectCards).toHaveCount(1);
  });

  test("a category without a name gets a numbered default", async ({
    page,
    loginWithDefaultProject,
  }) => {
    await loginWithDefaultProject(`${orgUrl()}/settings/categories`);
    const settings = new OrgSettingCategoriesPage(page);

    await settings.createCategory("");
    await expect(categoryCard(page, "Unnamed category")).toHaveCount(1);
    await settings.createCategory("");
    await expect(categoryCard(page, "Unnamed category 2")).toBeVisible();
  });
});
