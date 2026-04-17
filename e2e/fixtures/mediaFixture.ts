import { MediaPage } from "../pages/MediaPage";
import { test as base } from "./baseFixture";

type MediaFixture = {
  mediaPage: MediaPage;
  uppyUploadFile: (fileName: string) => Promise<void>;
};

export const test = base.extend<MediaFixture>({
  mediaPage: async ({ page }, use) => {
    const mediaPage = new MediaPage(page);
    await use(mediaPage);
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
