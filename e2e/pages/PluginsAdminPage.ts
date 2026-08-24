import { type Locator, type Page } from "@playwright/test";

/**
 * The org's Plugins page, its editor modal and the publish modal.
 *
 * Client plugins are authored entirely through this UI, so the specs drive it
 * rather than the mutations behind it: the editor gates publishing behind a
 * passing test build, and that gate only exists here.
 */
export class PluginsAdminPage {
  constructor(public readonly page: Page) {}

  async goto(orgSlug: string) {
    await this.page.goto(`/o/${orgSlug}/plugins`);
    // Exact, so it doesn't also match the "Your plugins" subheading.
    await this.page
      .getByRole("heading", { name: "Plugins", exact: true })
      .waitFor();
  }

  // --- List ---

  get newPluginButton(): Locator {
    return this.page.getByRole("button", { name: "New plugin" });
  }

  /** A plugin's row, matched by the title shown in it. */
  row(title: string): Locator {
    return this.page
      .locator("div")
      .filter({ hasText: title })
      .filter({ has: this.page.getByRole("button", { name: "Edit" }) })
      .last();
  }

  /** The install toggle. Only rendered once a version has been published. */
  enabledSwitch(title: string): Locator {
    return this.row(title).getByRole("switch");
  }

  async setEnabled(title: string, enabled: boolean) {
    const toggle = this.enabledSwitch(title);
    await toggle.waitFor();
    if ((await toggle.getAttribute("aria-checked")) === String(enabled)) return;
    await toggle.click();
    await this.row(title)
      .getByText(enabled ? "Enabled" : "Disabled", { exact: true })
      .waitFor();
  }

  async deletePlugin(title: string) {
    await this.row(title).getByRole("button", { name: "Delete" }).click();
    await this.page.getByTestId("popconfirm-confirm").click();
  }

  // --- New / edit details modal ---

  /**
   * Waits for the editor to be ready to edit.
   *
   * usePluginDraft loads the draft (or the latest published version) AFTER the
   * modal is on screen and REPLACES the buffer when it lands. The starter is
   * shown in the meantime, so "buffer is non-empty" is not enough: a build
   * started too early is invalidated the moment the fetch resolves, leaving the
   * editor stuck on "Edited since last build, re-test".
   *
   * `expectSource` pins the wait to content only the loaded source contains.
   * Without it this settles for a brand new plugin, whose buffer legitimately
   * stays the starter.
   */
  async waitForEditorReady(expectSource?: string) {
    await this.page.locator(".monaco-editor").first().waitFor();
    await this.page.waitForFunction(
      (marker) => {
        const editor = (window as any).__CPLUGIN_EDITOR__;
        if (!editor) return false;
        const value = editor.getValue?.() ?? "";
        if (value.length === 0) return false;
        return marker ? value.includes(marker) : true;
      },
      expectSource ?? null,
      { timeout: 30_000 },
    );
  }

  /**
   * Fills the details modal. Creating navigates straight into the editor,
   * which is where the source lives.
   */
  async createPlugin(title: string, description?: string) {
    await this.newPluginButton.click();
    await this.page.getByLabel("Name").fill(title);
    if (description !== undefined) {
      await this.page.getByLabel("Description").fill(description);
    }
    await this.page
      .getByRole("button", { name: "Create", exact: true })
      .click();
    await this.editorTitle(title).waitFor();
    await this.waitForEditorReady();
  }

  // --- Editor modal ---

  editorTitle(pluginTitle: string): Locator {
    return this.page.getByText(`Edit ${pluginTitle}`);
  }

  async openEditor(title: string, expectSource?: string) {
    await this.row(title).getByRole("button", { name: "Edit" }).click();
    await this.editorTitle(title).waitFor();
    await this.waitForEditorReady(expectSource);
  }

  get fileList(): Locator {
    return this.page.locator("aside").first();
  }

  fileTab(name: string): Locator {
    return this.fileList.getByText(name, { exact: true });
  }

  async selectFile(name: string) {
    await this.fileTab(name).click();
  }

  async addFile(name: string) {
    await this.page.getByRole("button", { name: "New file" }).click();
    await this.page.getByPlaceholder("component.tsx").fill(name);
    await this.page
      .getByRole("button", { name: "Create", exact: true })
      .click();
    await this.fileTab(name).waitFor();
  }

  async deleteFile(name: string) {
    // The row itself is also a button carrying this accessible name, so match
    // the delete control by its exact label.
    await this.page
      .getByRole("button", { name: `Delete ${name}`, exact: true })
      .click();
    await this.page.getByTestId("popconfirm-confirm").click();
    await this.fileTab(name).waitFor({ state: "detached" });
  }

  /**
   * Replaces the active file's contents via the editor's own model.
   *
   * Synthetic input into Monaco's hidden textarea is not reliable enough to
   * trust: Firefox applies one large insertText twice (duplicating the whole
   * file), and feeding it per line triggers auto-indent and auto-close bracket,
   * which corrupts nested JSX. Both fail silently, so a spec "passes" while
   * building untouched starter source. CodeEditor exposes the editor instance
   * for exactly this.
   */
  async replaceActiveFile(source: string) {
    await this.page.waitForFunction(
      () => !!(window as any).__CPLUGIN_EDITOR__,
      undefined,
      { timeout: 30_000 },
    );
    await this.page.evaluate((text) => {
      const editor = (window as any).__CPLUGIN_EDITOR__;
      if (!editor) throw new Error("plugin code editor not exposed");
      // setValue goes through the model, so React's onChange still fires and
      // the draft autosaves exactly as it would for a human edit.
      editor.setValue(text);
    }, source);
  }

  async writeFile(name: string, source: string) {
    await this.selectFile(name);
    await this.replaceActiveFile(source);
  }

  get testBuildButton(): Locator {
    return this.page.getByRole("button", { name: "Test build" });
  }

  get buildPassedIndicator(): Locator {
    return this.page.getByText("ready to publish");
  }

  get buildFailedIndicator(): Locator {
    return this.page.getByText("Build failed, see log");
  }

  /**
   * A real esbuild + Tailwind compile on a shared server. Under a full parallel
   * run several of these queue up, so the default 5s assertion timeout is not
   * enough.
   *
   * Specs that build must also raise the TEST timeout past this, or the 90s
   * per-test cap expires mid-build and this budget never applies. Use
   * `test.setTimeout(PluginsAdminPage.SPEC_TIMEOUT)`.
   */
  static readonly BUILD_TIMEOUT = 120_000;

  /** Test-level budget for a spec that runs one or more real builds. */
  static readonly SPEC_TIMEOUT = 240_000;

  async runTestBuild() {
    await this.testBuildButton.click();
  }

  async expectBuildPassed() {
    await this.buildPassedIndicator.waitFor({
      timeout: PluginsAdminPage.BUILD_TIMEOUT,
    });
  }

  async expectBuildFailed() {
    await this.buildFailedIndicator.waitFor({
      timeout: PluginsAdminPage.BUILD_TIMEOUT,
    });
  }

  /** The editor's inline build log. Not the toast, which says the same thing. */
  get buildLog(): Locator {
    return this.page.locator('[data-slot="alert"]');
  }

  /** The editor's version list, which only appears once one exists. */
  versionEntry(version: string): Locator {
    return this.fileList
      .locator("div")
      .filter({ hasText: new RegExp(`^${version}`) })
      .last();
  }

  get closeEditorButton(): Locator {
    // Toasts and the dialog's own X icon (which carries a screen-reader-only
    // "Close" label) share the name, so match the footer's design-system button.
    return this.page.locator('button[data-slot="button"]', {
      hasText: /^Close$/,
    });
  }

  // --- Publish modal ---

  get publishButton(): Locator {
    return this.page.getByRole("button", { name: "Publish", exact: true });
  }

  bumpOption(kind: "patch" | "minor" | "major"): Locator {
    return this.page.getByText(kind, { exact: true });
  }

  get customVersionInput(): Locator {
    return this.page.getByPlaceholder("1.2.3");
  }

  confirmPublishButton(version: string): Locator {
    return this.page.getByRole("button", { name: `Publish ${version}` });
  }

  get versionTakenWarning(): Locator {
    return this.page.getByText("Versions are immutable");
  }

  /**
   * Publishes through the modal. The editor closes on success, so waiting for
   * the row's badge is what proves the whole round trip landed.
   */
  async publish(
    pluginTitle: string,
    version: string,
    options?: { bump?: "patch" | "minor" | "major" },
  ) {
    await this.publishButton.click();
    if (options?.bump) {
      await this.bumpOption(options.bump).click();
    } else {
      await this.customVersionInput.fill(version);
    }
    await this.confirmPublishButton(version).click();
    await this.row(pluginTitle)
      .getByText(`latest ${version}`, { exact: true })
      .waitFor({ timeout: PluginsAdminPage.BUILD_TIMEOUT });
  }

  /** The badge summarising which version an org would get. */
  badge(title: string, text: string): Locator {
    return this.row(title).getByText(text, { exact: true });
  }
}
