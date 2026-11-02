import { Page } from "@playwright/test";

/** Opens the Manage outputs modal from the remote's sidebar Output section. */
export const openManageOutputs = async (page: Page) => {
  const outputSection = page.getByRole("button", {
    name: "Output",
    exact: true,
  });
  if ((await outputSection.getAttribute("aria-expanded")) !== "true") {
    await outputSection.click();
  }
  await page.getByRole("button", { name: "Manage outputs" }).click();
};

/** Shows an output's settings in the open Manage outputs modal */
export const expandOutput = async (page: Page, name: string) => {
  const show = page.getByRole("button", { name: `Show settings for ${name}` });
  if (await show.isVisible()) await show.click();
};

/** Shows the expanded output's advanced settings */
export const showAdvanced = async (page: Page) => {
  const advanced = page.getByRole("button", { name: "Advanced" });
  if ((await advanced.getAttribute("aria-expanded")) === "false") {
    await advanced.click();
  }
};

/** Opens an output's layout editor from the open Manage outputs modal */
export const openOutputLayout = async (page: Page, name = "Main") => {
  await expandOutput(page, name);
  const editLayout = page.getByRole("button", { name: "Edit layout" });
  // A custom layout shows it right away, a simple one under Advanced
  if (!(await editLayout.isVisible())) await showAdvanced(page);
  await page.getByRole("button", { name: /^(Customize|Edit) layout$/ }).click();
};

/** Picks a preset from "Add output" in the open Manage outputs modal */
export const addOutput = async (page: Page, preset: string) => {
  await page.getByRole("button", { name: "Add output" }).click();
  await page
    .getByRole("region", { name: "Add an output" })
    .getByText(new RegExp(`^${preset}$`, "i"))
    .click();
};
