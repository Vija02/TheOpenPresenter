import type { Locator, Page } from "@playwright/test";

import { expect, test } from "../../../fixtures/projectFixture";
import type { ProjectPage } from "../../../pages/ProjectPage";

/**
 * Layout editor behaviour, driven through the Bible plugin's "Slide Template"
 * dialog — the only surface that mounts LayoutWorkbench today.
 *
 * Lives here rather than under plugins/bible because the subject is
 * @repo/layout, not the Bible plugin: Bible is just the host that happens to
 * embed the editor. If another plugin adopts LayoutWorkbench, these tests stay
 * put and only the setup helper changes.
 *
 * Both Bible text elements ship as `shrinkToFit`. Anything that depends on a
 * SPECIFIC fit mode therefore sets it through the inspector first rather than
 * relying on the template — a test that silently depends on a preset's choice
 * breaks the next time that preset is retuned, and for a reason that has
 * nothing to do with what it was checking.
 */

const BODY = '[data-lay-id="bible-body"]';
const REFERENCE = '[data-lay-id="bible-reference"]';
const BACKGROUND = '[data-lay-id="bible-background"]';

type SetupArgs = {
  loginAndGoToProject: () => Promise<void> | void;
  projectPage: ProjectPage;
};

/** Creates a Bible scene and opens the Slide Template dialog. */
const openStyleModal = async ({
  loginAndGoToProject,
  projectPage,
}: SetupArgs) => {
  await loginAndGoToProject();
  await projectPage.createPlugin("Bible");
  await expect(projectPage.page.getByText("No passages yet")).toBeVisible();

  await projectPage.page.getByRole("button", { name: "Style" }).click();

  const dialog = projectPage.page.getByRole("dialog", {
    name: "Slide Template",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".lay--editor-surface")).toBeVisible();
  return dialog;
};

/**
 * An inspector row by its label.
 *
 * Row/MiniRow render `<div><span>Label</span>{control}</div>` — the label is a
 * span, not a <label>, so getByLabel() finds nothing. The direct-child
 * constraint is what keeps this from also matching every ancestor div.
 */
const row = (scope: Locator, label: string) =>
  scope.locator(`div:has(> span:text-is("${label}"))`).first();

/** Computed style of the rendered text, which inherits from the styled node. */
const textStyle = (page: Page, elementSelector: string, property: string) =>
  page
    .locator(`${elementSelector} .lay--text-content`)
    .evaluate(
      (el, prop) => getComputedStyle(el).getPropertyValue(prop),
      property,
    );

const fontSizePx = async (page: Page, elementSelector: string) =>
  parseFloat(await textStyle(page, elementSelector, "font-size"));

/** Drags from the centre of `target` by (dx, dy) as a real pointer gesture. */
const dragBy = async (page: Page, target: Locator, dx: number, dy: number) => {
  const box = await target.boundingBox();
  if (!box) throw new Error("element has no bounding box");
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Moveable commits once per gesture on release, and needs more than one move
  // to treat the pointer as a drag rather than a click.
  await page.mouse.move(startX + dx / 2, startY + dy / 2, { steps: 5 });
  await page.mouse.move(startX + dx, startY + dy, { steps: 5 });
  await page.mouse.up();
};

test.describe.serial("Layout editor", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
        e2eCommand.serverCommand("clearBibleData"),
      ]),
  );

  test("can move, resize and restyle an element from the inspector", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });
    const body = dialog.locator(BODY);

    await body.click();
    await expect(body).toHaveClass(/lay--editor-item--selected/);
    // Typography only renders for a selected text element, so its presence is
    // proof the right thing is selected. Avoids matching on the element name,
    // which collides with the "+ Verse text" binding chip in Content.
    await expect(dialog.getByText("Typography", { exact: true })).toBeVisible();

    // --- move, via Position & size -----------------------------------------
    const before = await body.boundingBox();
    await row(dialog, "X").locator("input").fill("20");
    await row(dialog, "X").locator("input").press("Tab");

    await expect
      .poll(async () => (await body.boundingBox())?.x)
      .not.toBe(before?.x);

    // --- resize -------------------------------------------------------------
    const moved = await body.boundingBox();
    await row(dialog, "W").locator("input").fill("40");
    await row(dialog, "W").locator("input").press("Tab");

    await expect
      .poll(async () => (await body.boundingBox())?.width)
      .toBeLessThan(moved!.width);

    // --- typography ---------------------------------------------------------
    await row(dialog, "Weight").locator("select").selectOption("700");
    await expect.poll(() => textStyle(page, BODY, "font-weight")).toBe("700");

    // Montserrat is a bundled webfont, so the family resolves rather than
    // falling back the way an uninstalled system font would.
    await row(dialog, "Font")
      .locator("select")
      .selectOption({ label: "Montserrat" });
    await expect
      .poll(() => textStyle(page, BODY, "font-family"))
      .toContain("Montserrat");

    // getByLabel, not getByRole("button"): ToggleGroup is type="single", so
    // Radix renders its items as role="radio" in a radiogroup. Matching the
    // aria-label sidesteps the primitive's role choice entirely.
    await dialog.getByLabel("Align left").click();
    await expect.poll(() => textStyle(page, BODY, "text-align")).toBe("left");
  });

  test("hover outlines the click target, and clicking off the slide deselects", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });
    const body = dialog.locator(BODY);
    const reference = dialog.locator(REFERENCE);

    // --- hover affordance ---------------------------------------------------
    // Asserted on outline-style rather than colour: the accent is authored in
    // oklch and browsers serialise it inconsistently.
    await expect(body).toHaveCSS("outline-style", "none");
    await body.hover();
    await expect(body).toHaveCSS("outline-style", "solid");
    await expect(body).toHaveCSS("outline-width", "2px");

    // --- selection ----------------------------------------------------------
    await body.click();
    await expect(body).toHaveClass(/lay--editor-item--selected/);

    await reference.click();
    await expect(reference).toHaveClass(/lay--editor-item--selected/);
    await expect(body).not.toHaveClass(/lay--editor-item--selected/);

    // --- drag to move -------------------------------------------------------
    // Selecto hands the gesture to Moveable only once the item is selected, so
    // this must come after the click above.
    const beforeDrag = await reference.boundingBox();
    await dragBy(page, reference, 0, -60);
    await expect
      .poll(async () => (await reference.boundingBox())?.y)
      .toBeLessThan(beforeDrag!.y);

    // --- drag a resize handle ----------------------------------------------
    const handle = page.locator(".moveable-control-box .moveable-e");
    await expect(handle).toBeVisible();

    const beforeResize = await reference.boundingBox();
    await dragBy(page, handle, -80, 0);
    await expect
      .poll(async () => (await reference.boundingBox())?.width)
      .toBeLessThan(beforeResize!.width);

    // --- click outside the slide -------------------------------------------
    // Inside <main> but outside .lay--editor, i.e. the p-6 gutter. This is the
    // case the old `e.target === e.currentTarget` check missed.
    await dialog.locator(".lay--workbench-canvas").click({
      position: { x: 5, y: 5 },
    });
    await expect(dialog.locator(".lay--editor-item--selected")).toHaveCount(0);
  });

  test("double-click edits the raw template and re-fits only auto-sized text", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });
    const body = dialog.locator(BODY);
    const reference = dialog.locator(REFERENCE);

    // --- enter edit mode ----------------------------------------------------
    await body.dblclick();
    await expect(body).toHaveClass(/lay--editor-item--editing/);

    // The Excel-formula behaviour: the editor shows the TEMPLATE, not the
    // substituted verse text that is rendered outside edit mode.
    await expect(body.locator(".lay--text-content")).toHaveText("{{verses}}");

    // --- auto-sized text re-fits as you type -------------------------------
    const sizeBefore = await fontSizePx(page, BODY);
    await page.keyboard.insertText(
      " Now a much longer body of text that has to wrap across several lines " +
        "and therefore forces the auto-fit to choose a smaller font size than " +
        "it did for the short template token on its own.",
    );
    await expect.poll(() => fontSizePx(page, BODY)).toBeLessThan(sizeBefore);

    // --- clicking outside commits and deselects ----------------------------
    await dialog.locator(".lay--workbench-canvas").click({
      position: { x: 5, y: 5 },
    });
    await expect(body).not.toHaveClass(/lay--editor-item--editing/);
    await expect(dialog.locator(".lay--editor-item--selected")).toHaveCount(0);
    await expect(body).toContainText("forces the auto-fit");

    // --- a fixed-size element must NOT re-fit ------------------------------
    await reference.click();
    await row(dialog, "Auto-size").locator("select").selectOption("declared");

    await reference.dblclick();
    await expect(reference).toHaveClass(/lay--editor-item--editing/);

    const referenceSizeBefore = await fontSizePx(page, REFERENCE);
    await page.keyboard.insertText(
      " plus a great deal of extra text that would certainly shrink this box " +
        "if it were auto-sized rather than declared.",
    );

    // `declared` reads style.fontSize and derives nothing, so the size holds no
    // matter how much text is typed.
    await expect
      .poll(() => fontSizePx(page, REFERENCE))
      .toBe(referenceSizeBefore);
  });

  test("arrow keys nudge the selection, except while editing text", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });
    const reference = dialog.locator(REFERENCE);

    await reference.click();
    await expect(reference).toHaveClass(/lay--editor-item--selected/);

    // Read the X field rather than a bounding box: a nudge is 0.5% of the
    // stage, which at some canvas widths is a sub-pixel move that
    // getBoundingClientRect would round away.
    const x = row(dialog, "X").locator("input");
    const readX = async () => Number(await x.inputValue());
    const startX = await readX();

    // Selecto preventDefaults pointerdown, so the surface only has focus
    // because selection explicitly gives it. If that regresses, this is the
    // assertion that catches it — the nudge is silent when unfocused.
    await page.keyboard.press("ArrowRight");
    await expect.poll(readX).toBeCloseTo(startX + 0.5, 5);

    // Shift multiplies the step by 10.
    await page.keyboard.press("Shift+ArrowRight");
    await expect.poll(readX).toBeCloseTo(startX + 5.5, 5);

    await page.keyboard.press("ArrowLeft");
    await expect.poll(readX).toBeCloseTo(startX + 5, 5);

    // --- arrows belong to the caret while editing --------------------------
    await reference.dblclick();
    await expect(reference).toHaveClass(/lay--editor-item--editing/);

    const beforeEditing = await readX();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");

    // The element must not move. Guarded on `isContentEditable`, which a
    // [contenteditable='true'] selector would miss — the editor uses
    // plaintext-only.
    await expect.poll(readX).toBe(beforeEditing);
  });

  test("the size control follows the fit mode", async ({
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });
    await dialog.locator(BODY).click();
    const autoSize = row(dialog, "Auto-size").locator("select");

    // Measured modes derive the size, so any size control would be a dead knob
    // and none is rendered.
    for (const measured of ["wrap", "fitNoWrap"]) {
      await autoSize.selectOption(measured);
      await expect(row(dialog, "Size")).toHaveCount(0);
      await expect(row(dialog, "Max size")).toHaveCount(0);
    }

    // Authored size, used verbatim.
    await autoSize.selectOption("declared");
    await expect(row(dialog, "Size").locator("input")).toBeVisible();

    // Authored size, used as a ceiling — which is why the label differs. The
    // labels are the only way to tell the two apart in the UI.
    await autoSize.selectOption("shrinkToFit");
    await expect(row(dialog, "Max size").locator("input")).toBeVisible();
    await expect(row(dialog, "Size")).toHaveCount(0);
  });
});
