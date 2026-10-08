import { type Locator, type Page } from "@playwright/test";

export class LyricsPlugin {
  readonly searchSongTitleInput: Locator;
  readonly addToListFormButton: Locator;
  readonly importFormButton: Locator;
  readonly styleButton: Locator;

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
    this.styleButton = page.getByRole("button", {
      name: "Global style",
      exact: true,
    });
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

  /** Press a key at the end of the line containing `lineText`. */
  async pressAtEndOfLine(lineText: string, key: string) {
    const line = this.songEditor.locator("p", { hasText: lineText }).first();
    await line.click();
    await this.songEditor.press("End");
    await this.songEditor.press(key);
  }

  /** Press a key with the caret at the start of `word`. */
  async pressBeforeWord(lineText: string, word: string, key: string) {
    const line = this.songEditor.locator("p", { hasText: lineText }).first();
    // Double-clicking selects the word; ArrowLeft collapses to its start.
    await line.getByText(word, { exact: false }).first().dblclick();
    await this.songEditor.press("ArrowLeft");
    await this.songEditor.press(key);
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
  // Layout (the style buttons open a layout workbench)
  // ---------------------------------------------------------------------------

  /** The organization's looks, on Main. Returns the dialog */
  async openStyleSettings(): Promise<Locator> {
    await this.styleButton.click();
    return this.layoutDialog("Global style");
  }

  /** A song's own looks, on the one it shows in. Returns the dialog */
  async openSongLayout(index = 0): Promise<Locator> {
    await this.page.getByTestId("ly-style-song").nth(index).click();
    return this.layoutDialog("Song style");
  }

  private async layoutDialog(title: string): Promise<Locator> {
    const dialog = this.page
      .getByRole("dialog")
      .filter({ has: this.page.getByRole("heading", { name: title }) });
    await dialog.locator(".lay--editor-surface").waitFor();
    return dialog;
  }

  /** Switches the dialog to another look, e.g. "Full song" */
  async switchLook(dialog: Locator, name: string) {
    await dialog
      .getByTestId("lyrics-look-switcher")
      .getByText(name, { exact: true })
      .click();
    await dialog.locator(".lay--editor-surface").waitFor();
  }

  /**
   * An inspector row by its label. Labels are spans, not <label>s, and the
   * direct-child constraint keeps ancestors from matching
   */
  inspectorRow(dialog: Locator, label: string): Locator {
    return dialog.locator(`div:has(> span:text-is("${label}"))`).first();
  }

  async selectLyrics(dialog: Locator) {
    await dialog.locator('[data-lay-id="lyrics-body"]').click();
    await dialog.getByText("Typography", { exact: true }).waitFor();
  }

  /**
   * The background is its own layer, set from the media library. Its Colour
   * card switches to a colour and opens the inspector's colour controls
   */
  async openBackgroundColour(dialog: Locator): Promise<Locator> {
    await dialog.getByTestId("layout-media-colour").click();
    const panel = this.page.getByTestId("layout-media-colour-panel");
    await panel.waitFor();
    return panel;
  }

  async setColour(dialog: Locator, label: string, hex: string) {
    await this.pickColour(this.inspectorRow(dialog, label), hex);
  }

  /**
   * Typing applies the colour. Closed by its swatch, as Escape would also
   * close the dialog
   */
  private async pickColour(scope: Locator, hex: string) {
    const swatch = scope.locator(".ui--color-picker__swatch");
    await swatch.click();
    const input = this.page.locator(".ui--color-picker__format-input");
    await input.fill(hex);
    await swatch.click();
    await input.waitFor({ state: "hidden" });
  }

  async setTextColor(dialog: Locator, hex: string) {
    await this.selectLyrics(dialog);
    await this.setColour(dialog, "Colour", hex);
  }

  async setVerticalAlign(dialog: Locator, align: "top" | "middle" | "bottom") {
    await this.selectLyrics(dialog);
    await dialog.getByLabel(`Align ${align}`).click();
  }

  async setFontWeight(dialog: Locator, weight: 400 | 600 | 700) {
    await this.selectLyrics(dialog);
    await this.inspectorRow(dialog, "Weight")
      .locator("select")
      .selectOption(String(weight));
  }

  async setFontStyle(dialog: Locator, style: "upright" | "italic") {
    await this.selectLyrics(dialog);
    await dialog
      .getByLabel(style === "italic" ? "Italic" : "Upright", { exact: true })
      .click();
  }

  /** A fixed ceiling the lyrics shrink from, in design units */
  async setMaxFontSize(dialog: Locator, size: number) {
    await this.selectLyrics(dialog);
    await this.inspectorRow(dialog, "Auto-size")
      .locator("select")
      .selectOption({ label: "Shrink to fit" });
    const input = this.inspectorRow(dialog, "Max size").locator("input");
    await input.fill(String(size));
    await input.press("Tab");
  }

  async setBackgroundColor(dialog: Locator, hex: string) {
    const panel = await this.openBackgroundColour(dialog);
    // Solid has the one colour picker in the panel
    await this.pickColour(panel, hex);
    // Toggle the panel closed; Escape here could close the dialog
    await dialog.getByTestId("layout-media-colour").click();
    await panel.waitFor({ state: "hidden" });
  }

  /**
   * Picks a preset from the rail, accepting the replace confirmation. By its
   * exact label: a card's name also holds its preview's text
   */
  async useTemplate(dialog: Locator, name: string) {
    this.page.once("dialog", (confirm) => void confirm.accept());
    await dialog
      .getByRole("button")
      .filter({ has: this.page.getByText(name, { exact: true }) })
      .click();
  }

  /**
   * The global style saves through the server, which then updates the
   * scene, so wait for it. A song's saves straight into the scene
   */
  async saveStyleSettings(dialog: Locator) {
    const isGlobal =
      (await dialog.getByRole("heading", { name: "Global style" }).count()) > 0;
    const saved = isGlobal
      ? this.page.waitForResponse(
          (response) =>
            response.url().includes("lyricsPresenter.looks.") &&
            response.request().method() === "POST",
        )
      : null;
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    await saved;
  }
}
