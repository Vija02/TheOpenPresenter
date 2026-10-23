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
