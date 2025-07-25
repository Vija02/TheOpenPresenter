import { LyricsPlugin } from "../pages/LyricsPlugin";
import { OrganizationPage } from "../pages/OrganizationPage";
import { ProjectPage } from "../pages/ProjectPage";
import { VideoPlayerPlugin } from "../pages/VideoPlayerPlugin";
import { test as base } from "./baseFixture";

type ProjectFixture = {
  projectPage: ProjectPage;
  organizationPage: OrganizationPage;
  lyricsPlugin: LyricsPlugin;
  videoPlayerPlugin: VideoPlayerPlugin;
  loginAndGoToProject: () => void;
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
  lyricsPlugin: async ({ page }, use) => {
    const lyricsPlugin = new LyricsPlugin(page);
    await use(lyricsPlugin);
  },
  videoPlayerPlugin: async ({ page }, use) => {
    const videoPlayerPlugin = new VideoPlayerPlugin(page);
    await use(videoPlayerPlugin);
  },
  loginAndGoToProject: async ({ e2eCommand }, use) => {
    const fn = async () => {
      await e2eCommand.login({
        orgs: [
          {
            name: "TestOrg",
            slug: "testorg",
            projects: [{ name: "TestProject", slug: "testproject" }],
          },
        ],
        next: "/app/testorg/testproject",
      });
    };

    await use(fn);
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
