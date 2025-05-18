import { OrganizationPage } from "../pages/OrganizationPage";
import { ProjectPage } from "../pages/ProjectPage";
import { test as base } from "./baseFixture";

type ProjectFixture = {
  projectPage: ProjectPage;
  organizationPage: OrganizationPage;
  uppyUploadFile: (fileName: string) => void;
};

export const test = base.extend<ProjectFixture>({
  organizationPage: async ({ page }, use) => {
    const organizationPage = new OrganizationPage(page);
    await use(organizationPage);
  },
  projectPage: async ({ page }, use) => {
    const projectPage = new ProjectPage(page);
    await use(projectPage);
  },
  uppyUploadFile: async ({ page }, use) => {
    const upload = async (fileName: string) => {
      const [fileChooser] = await Promise.all([
        page.waitForEvent("filechooser"),
        page.getByRole("button", { name: "browse files" }).click(),
      ]);
      await fileChooser.setFiles(fileName);
      await page.getByRole("button", { name: "Upload 1 file" }).click();
    };

    await use(upload);
  },
});

export { expect } from "@playwright/test";
