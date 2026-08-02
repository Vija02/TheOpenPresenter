import { type BrowserContext, type Locator, type Page } from "@playwright/test";

const pluginsList = [
  "Embed",
  "Slides",
  "Lyrics Presenter",
  "Timer",
  "Video Player",
  "Audio Recorder",
  "Radio",
  "Worship Pads",
  "Bible",
  "Screen Share",
] as const;

export class ProjectPage {
  readonly newSceneButton: Locator;
  readonly presentButton: Locator;

  constructor(
    public readonly page: Page,
    public readonly context: BrowserContext,
  ) {
    this.newSceneButton = page.getByTestId("add-scene");
    this.presentButton = page.getByRole("button", { name: "Present" });
  }

  async createPlugin(plugin: (typeof pluginsList)[number]) {
    await this.newSceneButton.click({ force: true });

    await this.page.getByText(plugin, { exact: true }).click({ force: true });
  }

  pluginOption(plugin: (typeof pluginsList)[number]): Locator {
    return this.page.getByText(plugin, { exact: true });
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
      name: "Stop presenting to this screen",
    });
  }

  get noScreensSetUpLink(): Locator {
    return this.page.getByRole("link", { name: "Set up a screen" });
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
    // Exact, so it doesn't also match "Stop presenting to this screen".
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

  // --- Preview window ---

  get previewToggleButton(): Locator {
    // Both sidebars (web + mobile) are always mounted and hidden with CSS, so
    // a CSS locator would match two buttons. Role locators skip anything
    // display:none. `exact` matters too: name matching is substring by
    // default, which would also hit "Close preview" once the window is open.
    return this.page.getByRole("button", { name: "Preview", exact: true });
  }

  get previewWindow(): Locator {
    return this.page.getByTestId("preview-window");
  }

  get previewWindowHeader(): Locator {
    return this.page.getByTestId("preview-window-header");
  }

  get previewFrame(): Locator {
    return this.page.getByTitle("Renderer preview");
  }

  get previewCloseButton(): Locator {
    return this.page.getByRole("button", { name: "Close preview" });
  }

  get previewMuteButton(): Locator {
    return this.page.getByRole("button", { name: /^(Mute|Unmute)$/ });
  }

  get previewResizeGrip(): Locator {
    return this.page.getByTitle("Resize");
  }

  async openPreviewWindow() {
    await this.previewToggleButton.click();
    await this.previewWindow.waitFor();
  }

  /** Bounding box of the floating window, failing loudly if it isn't laid out. */
  async previewWindowBox() {
    const box = await this.previewWindow.boundingBox();
    if (!box) throw new Error("Preview window has no bounding box");
    return box;
  }

  /** Drags the window by its header using real pointer events. */
  async dragPreviewWindowBy(dx: number, dy: number) {
    const header = await this.previewWindowHeader.boundingBox();
    if (!header) throw new Error("Preview window header has no bounding box");

    const startX = header.x + header.width / 2;
    const startY = header.y + header.height / 2;

    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    // Intermediate move: a single jump can be treated as no drag at all.
    await this.page.mouse.move(startX + dx / 2, startY + dy / 2);
    await this.page.mouse.move(startX + dx, startY + dy);
    await this.page.mouse.up();
  }

  /** Drags the bottom-right grip, which resizes by width at a locked 16:9. */
  async resizePreviewWindowBy(dx: number) {
    const grip = await this.previewResizeGrip.boundingBox();
    if (!grip) throw new Error("Resize grip has no bounding box");

    const startX = grip.x + grip.width / 2;
    const startY = grip.y + grip.height / 2;

    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    await this.page.mouse.move(startX + dx / 2, startY);
    await this.page.mouse.move(startX + dx, startY);
    await this.page.mouse.up();
  }
}
