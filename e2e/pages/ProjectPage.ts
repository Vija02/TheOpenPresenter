import {
  type BrowserContext,
  type FrameLocator,
  type Locator,
  type Page,
} from "@playwright/test";

const pluginsList = [
  "Embed",
  "Slides",
  "Lyrics Presenter",
  "Timer",
  "Video Player",
  "Audio Recorder",
  "Music Player",
  "Worship Pads",
  "Bible",
  "Screen Share",
  "Slido",
] as const;

export class ProjectPage {
  readonly newSceneButton: Locator;
  readonly presentButton: Locator;

  constructor(
    public readonly page: Page,
    public readonly context: BrowserContext,
  ) {
    this.newSceneButton = page.getByTestId("add-scene");
    // The top bar's; the sidebar has one too, under the scene list
    this.presentButton = page
      .getByRole("button", { name: "Present", exact: true })
      .first();
  }

  async createPlugin(plugin: (typeof pluginsList)[number]) {
    await this.newSceneButton.click({ force: true });

    await this.page.getByText(plugin, { exact: true }).click({ force: true });
  }

  pluginOption(plugin: (typeof pluginsList)[number]): Locator {
    return this.page.getByText(plugin, { exact: true });
  }

  sceneCreatorOption(title: string): Locator {
    return this.page.locator(".ui--option").filter({
      has: this.page
        .locator(".ui--option__title")
        .filter({ hasText: new RegExp(`^${title}$`) }),
    });
  }

  async present() {
    // The Present button opens a popover; "Open in new tab" is a link whose
    // href is the renderer URL.
    await this.openPresentMenu();
    const url = await this.openInNewTabLink.getAttribute("href");
    await this.closePresentMenu();
    const newPage = await this.context.newPage();
    await newPage.goto(url!);
    return newPage;
  }

  // --- Present popover ---

  async openPresentMenu() {
    await this.presentButton.click();
  }

  async closePresentMenu() {
    await this.page.keyboard.press("Escape");
    await this.openInNewTabLink.waitFor({ state: "hidden" });
  }

  get openInNewTabLink(): Locator {
    return this.page.getByRole("link", { name: "Open in new tab" });
  }

  /** A screen row's "present to this screen" button, matched by screen name. */
  presentScreenOption(screenName: string): Locator {
    return this.page.getByRole("button", { name: screenName });
  }

  get presentingHereIndicator(): Locator {
    return this.page.getByText("Presenting here");
  }

  get stopPresentingButton(): Locator {
    return this.page.getByRole("button", {
      name: "Stop presenting to this virtual screen",
    });
  }

  get noScreensSetUpLink(): Locator {
    return this.page.getByRole("link", { name: "Set up a virtual screen" });
  }

  // --- Present from phone ---

  get presentFromPhoneOption(): Locator {
    return this.page.getByRole("button", { name: "Present from phone" });
  }

  /** Mirrors the QR target so we don't have to decode the image. */
  get phoneQrUrl(): Locator {
    return this.page.getByTestId("phone-present-qr-url");
  }

  get presentOnThisScreenButton(): Locator {
    return this.page.getByRole("button", { name: "Present on this screen" });
  }

  /** The renderer iframe inside the fullscreen-ish overlay. */
  get presentOverlayFrame(): Locator {
    return this.page.getByTitle("Presentation");
  }

  get stopPresentingOverlayButton(): Locator {
    // Exact, so it doesn't also match "Stop presenting to this virtual screen".
    return this.page.getByRole("button", {
      name: "Stop presenting",
      exact: true,
    });
  }

  async openPresentFromPhone() {
    await this.openPresentMenu();
    await this.presentFromPhoneOption.click();
    await this.phoneQrUrl.waitFor({ state: "attached" });
  }

  // --- Preview panel ---

  get previewToggleButton(): Locator {
    // The sidebar section's header. `exact` keeps it from matching other
    // buttons that mention the preview.
    return this.page.getByRole("button", { name: "Preview", exact: true });
  }

  get previewPanel(): Locator {
    return this.page.getByTestId("preview-panel");
  }

  get previewFrame(): Locator {
    return this.page.getByTitle("Renderer preview");
  }

  /** The renderer document inside the preview iframe. */
  get previewFrameContent(): FrameLocator {
    return this.page.frameLocator('iframe[title="Renderer preview"]');
  }

  get previewMuteButton(): Locator {
    return this.page.getByRole("button", { name: /^(Mute|Unmute)$/ });
  }

  /** The drag handle on the right edge of the desktop sidebar. */
  get sidebarResizeHandle(): Locator {
    return this.page.locator(
      ".sidebar-resizable-container .react-resizable-handle-e",
    );
  }

  /** Bounding box of the panel, failing loudly if it isn't laid out. */
  async previewPanelBox() {
    const box = await this.previewPanel.boundingBox();
    if (!box) throw new Error("Preview panel has no bounding box");
    return box;
  }

  /** Drags the desktop sidebar's right edge; positive widens it. */
  async resizeSidebarBy(dx: number) {
    const handle = await this.sidebarResizeHandle.boundingBox();
    if (!handle) throw new Error("Sidebar resize handle has no bounding box");

    const startX = handle.x + handle.width / 2;
    const startY = handle.y + handle.height / 2;

    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    // Intermediate move: a single jump can be treated as no drag at all.
    await this.page.mouse.move(startX + dx / 2, startY);
    await this.page.mouse.move(startX + dx, startY);
    await this.page.mouse.up();
  }
}
