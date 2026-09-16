import { type Locator, type Page } from "@playwright/test";

export class LyricsPlugin {
  readonly searchSongTitleInput: Locator;
  readonly addToListFormButton: Locator;
  readonly importFormButton: Locator;
  readonly styleButton: Locator;
  readonly saveStyleButton: Locator;

  constructor(public readonly page: Page) {
    // The unified search box (songbook + MyWorshipList import).
    this.searchSongTitleInput = page.getByPlaceholder("Search songs...");
    this.addToListFormButton = page.getByRole("button", {
      name: "Add to list",
    });
    this.importFormButton = page.getByRole("button", {
      name: "Import",
      exact: true,
    });
    this.styleButton = page.getByRole("button", { name: "Style", exact: true });
    this.saveStyleButton = page.getByRole("button", { name: "Save" });
  }

  // ---------------------------------------------------------------------------
  // Add-song modal
  // ---------------------------------------------------------------------------

  /** The currently-open dialog (modal add-song, or a Landing sub-route). */
  get dialog(): Locator {
    return this.page.getByRole("dialog");
  }

  /**
   * The add-song UI lives in two places that share the same MainView:
   *  - a fresh plugin (0 songs) renders it inline in the Landing;
   *  - once songs exist, the body "Add Song" button opens it in a modal.
   * Resolve whichever is current (opening the modal when songs exist) and
   * return the Locator to scope add-song interactions to.
   */
  async openAddSurface(): Promise<Locator> {
    // Wait for the remote body to settle into one of the two states.
    await this.page
      .locator('[data-testid="ly-add-song"], [data-testid="ly-landing"]')
      .first()
      .waitFor();

    const addSongButton = this.page.getByTestId("ly-add-song");
    if (await addSongButton.count()) {
      await addSongButton.click();
      return this.dialog;
    }
    // Fresh plugin — the inline Landing is the add surface.
    return this.page.getByTestId("ly-landing");
  }

  /**
   * Open the full add-song modal via the always-present toolbar button. Use
   * this when you need the create flow — only the modal exposes "Create new
   * song". Returns the dialog scope.
   */
  async openAddModal(): Promise<Locator> {
    await this.page.getByTestId("ly-toolbar-add-song").click();
    return this.dialog;
  }

  /**
   * Import a single song from MyWorshipList: search for it, pick the result
   * (which opens the "Import a song" view), then confirm with Import.
   * NOTE: hits the live MyWorshipList API.
   */
  async addSong(songName: string) {
    const scope = await this.openAddSurface();
    await scope.getByPlaceholder("Search songs...").fill(songName);

    // Target the MyWorshipList "Import" section specifically — the search also
    // renders Songbook matches (and recent songs), which we must not pick here.
    await scope
      .getByTestId("ly-import-result")
      .filter({ hasText: songName })
      .first()
      .click();

    // Import view: wait for the lyrics to load, then confirm.
    await this.dialog
      .getByRole("button", { name: "Import", exact: true })
      .click();
  }

  /**
   * Import a song but stop before confirming — leaves the "Import a song" view
   * open so a test can toggle "Save to songbook", edit, etc.
   */
  async openImportSong(songName: string) {
    const scope = await this.openAddSurface();
    await scope.getByPlaceholder("Search songs...").fill(songName);
    await scope
      .getByTestId("ly-import-result")
      .filter({ hasText: songName })
      .first()
      .click();
    // Wait for the import view to hydrate (the editable title appears).
    await this.dialog.getByPlaceholder("Song name").first().waitFor();
  }

  async addCustomSong(
    title: string,
    content: string,
    displayType: "sections" | "fullSong" = "sections",
  ) {
    // Creating a song is only available from the modal (not the Landing).
    const dialog = await this.openAddModal();

    await dialog.getByRole("button", { name: "Create new song" }).click();
    await dialog.getByLabel("Title").fill(title);

    if (displayType === "fullSong") {
      await dialog.getByText("Full Song").click();
    }

    const editor = dialog
      .getByTestId("ly-song-editor")
      .locator('[contenteditable="true"]');
    await editor.click();
    await editor.press("ControlOrMeta+a");
    await editor.press("Backspace");
    await editor.pressSequentially(content);

    await dialog.getByRole("button", { name: "Add to list" }).click();
  }

  /**
   * Switch MyWorshipList on if it isn't already.
   *
   * A new organization has no setlist source enabled, so the add surface shows
   * the empty state rather than any setlist cards. Picking a source is what
   * replaces it with the real thing.
   */
  async enableMyWorshipList() {
    const scope = await this.openAddSurface();

    const enableButton = scope.getByTestId("ly-enable-mwl");
    // Already on for this org (the empty state is gone), nothing to do.
    if (!(await enableButton.count())) return scope;

    await enableButton.click();
    await enableButton.waitFor({ state: "detached" });
    return scope;
  }

  /**
   * Import a setlist: pick the first setlist card, then confirm with Import.
   * NOTE: hits the live MyWorshipList API.
   */
  async importFirstSetlist() {
    const scope = await this.enableMyWorshipList();
    // The setlist cards are shown by default under "Import a setlist".
    const firstCard = scope.getByTestId("ly-setlist-card").first();
    await firstCard.click();
    await this.dialog
      .getByRole("button", { name: "Import", exact: true })
      .click();
  }

  // ---------------------------------------------------------------------------
  // Setlist sources (Planning Center + MyWorshipList)
  // ---------------------------------------------------------------------------

  /** Open the "Setlist sources" settings modal from the add-song surface. */
  async openSetlistSourcesModal(): Promise<Locator> {
    await this.openAddSurface();
    await this.page.getByTestId("ly-setlist-sources").click();
    return this.dialog;
  }

  /**
   * Run the Planning Center OAuth round trip.
   *
   * The connect button opens a popup, which the fake PCO redirects straight
   * back to the app's callback. The callback page posts a message to its opener
   * and closes itself, so all this has to do is wait for the popup to go away.
   */
  async connectPlanningCenter(button: Locator) {
    const popupPromise = this.page.waitForEvent("popup");
    await button.click();
    const popup = await popupPromise;
    await popup.waitForEvent("close", { timeout: 30_000 }).catch(async () => {
      // The popup only closes itself on the happy path. On failure it stays up
      // showing the reason, which the opener has already been told about.
      await popup.close();
    });
  }

  get pcoConnectionRow(): Locator {
    return this.page.getByTestId("ly-pco-connection");
  }

  async disconnectPlanningCenter() {
    await this.page.getByTestId("ly-pco-disconnect").click();
    await this.page.getByRole("button", { name: "Yes" }).click();
  }

  // ---------------------------------------------------------------------------
  // Public (unauthenticated) access
  // ---------------------------------------------------------------------------

  /**
   * Only rendered for viewers with a session — the songbook is org-scoped.
   */
  get songbookButton(): Locator {
    return this.page.getByTestId("ly-songbook-button");
  }

  // ---------------------------------------------------------------------------
  // Songbook (per-song save + browse modal)
  // ---------------------------------------------------------------------------

  /** Save an unlinked song to the songbook via its "Unsaved" → Save badge. */
  async saveSongToSongbook(index = 0) {
    await this.page.getByTestId("ly-save-song").nth(index).click();
  }

  savedBadge(index = 0): Locator {
    return this.page.getByTestId("ly-save-song").nth(index);
  }

  async openSongbookModal() {
    const button = await Promise.race([
      this.page.waitForSelector(`[data-testid="ly-songbook-button"]`),
      this.page.waitForSelector(`[data-testid="ly-browse-songbook"]`),
    ]);
    await button.click();
  }

  songbookRow(title: string): Locator {
    return this.page.getByTestId("ly-songbook-row").filter({ hasText: title });
  }

  async songbookAddToList(title: string) {
    await this.songbookRow(title)
      .getByRole("button", { name: "Add", exact: true })
      .click();
  }

  async songbookDelete(title: string) {
    await this.songbookRow(title)
      .getByRole("button", { name: "Delete" })
      .click();
    await this.page.getByRole("button", { name: "Yes" }).click();
  }

  // ---------------------------------------------------------------------------
  // Chords
  // ---------------------------------------------------------------------------

  /** Open the edit modal for a song already on the list. */
  async openEditSong(index = 0) {
    await this.page.getByTestId("ly-edit-song").nth(index).click();
    return this.dialog;
  }

  /** The editor's text, one line per paragraph. */
  async editorText(): Promise<string> {
    return this.songEditor.innerText();
  }

  get songEditor(): Locator {
    return this.page
      .getByTestId("ly-song-editor")
      .locator('[contenteditable="true"]');
  }

  get toggleChordsButton(): Locator {
    return this.page.getByTestId("ly-toggle-chords");
  }

  get chordToolbar(): Locator {
    return this.page.getByTestId("ly-chord-toolbar");
  }

  get transposeKey(): Locator {
    return this.page.getByTestId("ly-key");
  }

  async showChords() {
    await this.page
      .getByTestId("ly-toggle-chords")
      .filter({ hasText: "Show chords" })
      .click();
  }

  async hideChords() {
    await this.page
      .getByTestId("ly-toggle-chords")
      .filter({ hasText: "Hide chords" })
      .click();
  }

  async transposeUp() {
    await this.page.getByTestId("ly-transpose-up").click();
  }

  async transposeDown() {
    await this.page.getByTestId("ly-transpose-down").click();
  }

  async removeAllChords() {
    await this.page.getByTestId("ly-remove-chords").click();
  }

  /**
   * Replace the whole editor contents. Note this clears the editor first, so
   * any chords go with it: that is a real deletion, not an edit.
   */
  async setEditorContent(content: string) {
    const editor = this.songEditor;
    await editor.click();
    await editor.press("ControlOrMeta+a");
    await editor.press("Backspace");
    await editor.pressSequentially(content);
  }

  /** Type at the start of a line, the way someone adding a chord would. */
  async typeAtStartOfLine(lineText: string, text: string) {
    const line = this.songEditor.locator("p", { hasText: lineText }).first();
    await line.click();
    await this.songEditor.press("Home");
    await this.songEditor.pressSequentially(text);
  }

  /** Type at the very end of the song, the way an ordinary edit would. */
  async appendToEditor(text: string) {
    const editor = this.songEditor;
    await editor.click();
    await editor.press("ControlOrMeta+End");
    await editor.pressSequentially(text);
  }

  async closeDialog() {
    await this.page.keyboard.press("Escape");
  }

  // ---------------------------------------------------------------------------
  // Style settings
  // ---------------------------------------------------------------------------

  async openStyleSettings() {
    await this.styleButton.click();
  }

  // Tab navigation
  async goToTextTab() {
    await this.page.getByRole("tab", { name: "Text" }).click();
  }

  async goToPlacementTab() {
    await this.page.getByRole("tab", { name: "Placement" }).click();
  }

  async goToBackgroundTab() {
    await this.page.getByRole("tab", { name: "Background" }).click();
  }

  // Text tab methods
  async setTextColor(color: string) {
    await this.goToTextTab();
    const colorInput = this.page
      .getByTestId("form-item-textColor")
      .locator("input");
    await colorInput.fill(color);
  }

  async toggleTextShadow() {
    await this.goToTextTab();
    await this.page.getByLabel("Text Shadow").click();
  }

  async toggleTextOutline() {
    await this.goToTextTab();
    await this.page.getByLabel("Text Outline").click();
  }

  async setVerticalAlign(align: "top" | "center" | "bottom") {
    await this.goToPlacementTab();
    await this.page.getByLabel(`Align ${align}`).click();
  }

  async toggleBold() {
    await this.goToTextTab();
    await this.page.getByLabel("Toggle bold").click();
  }

  async toggleItalic() {
    await this.goToTextTab();
    await this.page.getByLabel("Toggle italic").click();
  }

  async setAutoSize(autoSize: boolean) {
    await this.goToTextTab();
    if (autoSize) {
      await this.page.getByText("Auto fit").click();
    } else {
      await this.page.getByText("Manual", { exact: true }).click();
    }
  }

  async setFontSize(size: number) {
    await this.goToTextTab();
    await this.page
      .getByTestId("form-item-fontSize")
      .locator("input")
      .fill(size.toString());
  }

  // Background tab methods
  async setBackgroundType(type: "Solid Color" | "Video") {
    await this.goToBackgroundTab();
    await this.page.getByTestId("form-item-backgroundType").click();
    await this.page.getByRole("option", { name: type }).click();
  }

  async setBackgroundColor(color: string) {
    await this.goToBackgroundTab();
    const colorInput = this.page
      .getByTestId("form-item-backgroundColor")
      .locator("input");
    await colorInput.fill(color);
  }

  // Placement tab methods
  async setPadding(padding: number) {
    await this.goToPlacementTab();
    await this.page
      .getByTestId("form-item-padding")
      .locator("input")
      .fill(padding.toString());
  }

  async togglePaddingLink() {
    await this.goToPlacementTab();
    await this.page
      .getByTestId("form-item-paddingIsLinked")
      .getByRole("button")
      .click();
  }

  async setIndividualPadding(padding: {
    left?: number;
    top?: number;
    right?: number;
    bottom?: number;
  }) {
    await this.goToPlacementTab();
    if (padding.left !== undefined) {
      await this.page
        .getByTestId("form-item-leftPadding")
        .locator("input")
        .fill(padding.left.toString());
    }
    if (padding.top !== undefined) {
      await this.page
        .getByTestId("form-item-topPadding")
        .locator("input")
        .fill(padding.top.toString());
    }
    if (padding.right !== undefined) {
      await this.page
        .getByTestId("form-item-rightPadding")
        .locator("input")
        .fill(padding.right.toString());
    }
    if (padding.bottom !== undefined) {
      await this.page
        .getByTestId("form-item-bottomPadding")
        .locator("input")
        .fill(padding.bottom.toString());
    }
  }

  async saveStyleSettings() {
    await this.saveStyleButton.click();
  }
}
