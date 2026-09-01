import type { Locator, Page } from "@playwright/test";

import type { E2ECommandAPI } from "../../../e2eCommand";
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
  await expect(
    projectPage.page.getByText("Add a passage to get started"),
  ).toBeVisible();

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

/**
 * The body of one inspector accordion, for scoping `row()`.
 *
 * Necessary because row labels are NOT unique across the whole inspector:
 * "Align" is both Typography's horizontal alignment and the border's stroke
 * alignment, and `row()` ends in `.first()`, so an unscoped lookup silently
 * returns whichever comes first in the DOM.
 */
const section = (dialog: Locator, title: string) =>
  dialog
    .locator('[data-slot="accordion-item"]')
    .filter({ has: dialog.page().getByRole("button", { name: title }) })
    .locator('[data-slot="accordion-content"]');

/** Computed style of the rendered text, which inherits from the styled node. */
const textStyle = (page: Page, elementSelector: string, property: string) =>
  page
    .locator(`${elementSelector} .lay--text-content`)
    .evaluate(
      (el, prop) => getComputedStyle(el).getPropertyValue(prop),
      property,
    );

/**
 * Computed style of the node that actually carries the fill.
 *
 * `[data-lay-id]` is the EDITOR's wrapper. The element itself renders inside it
 * with placement="fill", and that inner node is what appearanceToCss styles —
 * so reading the wrapper reports the transparent default no matter what the
 * fill is set to. For text that node is the parent of `.lay--text-content`.
 */
const paintedStyle = (page: Page, elementSelector: string, property: string) =>
  page.locator(`${elementSelector} .lay--text-content`).evaluate((el, prop) => {
    const painted = el.parentElement;
    if (!painted) throw new Error("text content has no painted parent");
    return getComputedStyle(painted).getPropertyValue(prop);
  }, property);

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

  test("rotates from the handle and from the inspector", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });
    const reference = dialog.locator(REFERENCE);

    await reference.click();
    await expect(reference).toHaveClass(/lay--editor-item--selected/);

    const rotation = row(dialog, "Rotation").locator("input");
    await expect(rotation).toHaveValue("0");

    // --- the numeric field --------------------------------------------------
    await rotation.fill("30");
    await rotation.press("Tab");

    // The wrapper carries the angle, not the inner view: rotation rides with
    // placement, and the editor renders its children with placement="fill".
    await expect
      .poll(() => reference.evaluate((el) => getComputedStyle(el).transform))
      // matrix(cos30, sin30, -sin30, cos30, ...) — asserted loosely because the
      // translation components depend on the canvas size.
      .toMatch(/^matrix\(0\.86602[45]\d*, 0\.5, -0\.5, 0\.86602[45]/);

    // Wraps rather than clamping, so a full turn reads as zero again.
    await rotation.fill("390");
    await rotation.press("Tab");
    await expect(rotation).toHaveValue("30");

    await rotation.fill("0");
    await rotation.press("Tab");
    await expect
      .poll(() => reference.evaluate((el) => getComputedStyle(el).transform))
      .toBe("none");

    // --- the drag handle ----------------------------------------------------
    // Sits above the box, outside it. The reference element is mid-stage in the
    // default template, so the handle is not clipped by `.lay--editor`.
    const handle = page.locator(
      ".moveable-control-box .moveable-rotation-control",
    );
    await expect(handle).toBeVisible();

    // Sideways from a handle that starts above the centre swings the element
    // round. The 15 degree snap makes the committed value exact.
    await dragBy(page, handle, 120, 40);

    await expect
      .poll(async () => Number(await rotation.inputValue()))
      .not.toBe(0);

    // Snapped, so the angle is a clean multiple rather than whatever the
    // pointer happened to subtend.
    const snapped = Number(await rotation.inputValue());
    expect(snapped % 15).toBe(0);
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

  test("casing is applied by CSS, leaving the stored text untouched", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });
    await dialog.locator(BODY).click();

    const content = page.locator(`${BODY} .lay--text-content`);
    const original = (await content.textContent()) ?? "";
    expect(original).not.toBe("");

    await row(dialog, "Case").getByRole("radio", { name: "UPPERCASE" }).click();

    await expect(content).toHaveCSS("text-transform", "uppercase");

    // The point of doing this in CSS: `textContent` still reports the author's
    // original casing, so the template text (and any {{token}} in it) survives.
    expect(await content.textContent()).toBe(original);

    // ...and it is reversible, which rewriting the content would not be.
    await row(dialog, "Case").getByRole("radio", { name: "As typed" }).click();
    await expect(content).toHaveCSS("text-transform", "none");
    expect(await content.textContent()).toBe(original);
  });

  test("uppercasing re-fits auto-sized text, because capitals are wider", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });
    await dialog.locator(BODY).click();

    // `wrap` derives the size purely by measurement, so the fitted size is the
    // observable proof that the measurement saw the casing.
    await row(dialog, "Auto-size").locator("select").selectOption("wrap");
    const before = await fontSizePx(page, BODY);
    expect(before).toBeGreaterThan(0);

    await row(dialog, "Case").getByRole("radio", { name: "UPPERCASE" }).click();
    await expect(page.locator(`${BODY} .lay--text-content`)).toHaveCSS(
      "text-transform",
      "uppercase",
    );

    // Strictly smaller, not merely "no bigger". Were the measurement blind to
    // textTransform it would return the SAME size and the text would overflow —
    // and a <= assertion would pass in exactly that broken case. Measured at
    // 48px -> 45px, so the margin is real rather than sub-pixel noise.
    await expect.poll(() => fontSizePx(page, BODY)).toBeLessThan(before);
  });

  test("padding insets the text without moving the box, and re-fits it", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });
    await dialog.locator(BODY).click();

    // `wrap` derives the size purely by measurement, so the fitted size is the
    // observable proof that the fitter saw the padding.
    await row(dialog, "Auto-size").locator("select").selectOption("wrap");

    const geometry = () =>
      page.locator(`${BODY} .lay--text-content`).evaluate((el) => {
        const painted = el.parentElement;
        if (!painted) throw new Error("text content has no painted parent");
        const box = painted.getBoundingClientRect();
        return {
          boxWidth: +box.width.toFixed(1),
          boxHeight: +box.height.toFixed(1),
          contentWidth: +el.getBoundingClientRect().width.toFixed(1),
        };
      });

    const before = await geometry();
    const sizeBefore = await fontSizePx(page, BODY);
    expect(sizeBefore).toBeGreaterThan(0);

    const padding = row(dialog, "Padding").locator("input");
    await padding.fill("3");
    await padding.press("Tab");

    await expect
      .poll(async () => (await geometry()).contentWidth)
      .toBeLessThan(before.contentWidth);

    const after = await geometry();

    // The element must not move or grow: padding is an inset, so it comes out of
    // the existing box. Under the default content-box it would instead push the
    // element past the rect it was placed at.
    expect(await paintedStyle(page, BODY, "box-sizing")).toBe("border-box");
    expect(after.boxWidth).toBe(before.boxWidth);
    expect(after.boxHeight).toBe(before.boxHeight);

    // Inset on both sides of both axes, hence twice the padding.
    const inset = before.contentWidth - after.contentWidth;
    const cssPadding = parseFloat(
      await paintedStyle(page, BODY, "padding-left"),
    );
    expect(inset).toBeCloseTo(2 * cssPadding, 0);

    // Strictly smaller: were the fitter blind to padding it would return the
    // same size and the text would overflow into the space just reserved.
    await expect.poll(() => fontSizePx(page, BODY)).toBeLessThan(sizeBefore);
  });

  test("padding unlinks to four sides, and relinking keeps the linked value", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });
    await dialog.locator(BODY).click();

    // Measured mode, so the fitted size reacts to the space padding reserves.
    await row(dialog, "Auto-size").locator("select").selectOption("wrap");

    const padding = () => paintedStyle(page, BODY, "padding");

    // --- linked: one value on all four sides --------------------------------
    const linked = row(dialog, "Padding").locator("input");
    await linked.fill("2");
    await linked.press("Tab");

    await expect.poll(padding).toMatch(/^(\d|\.)+px$/);
    const linkedPadding = await padding();
    const linkedSize = await fontSizePx(page, BODY);

    // --- unlinked: independent sides, in CSS order --------------------------
    await dialog.getByRole("button", { name: "Padding linked" }).click();

    for (const [label, value] of [
      ["T", "1"],
      ["R", "2"],
      ["B", "3"],
      ["L", "4"],
    ] as const) {
      const field = row(dialog, label).locator("input");
      await field.fill(value);
      await field.press("Tab");
    }

    // Four distinct values, ascending T < R < B < L, proves each side is wired
    // to its own edge rather than all four reading one field.
    await expect.poll(async () => (await padding()).split(" ").length).toBe(4);

    const sides = (await padding()).split(" ").map(parseFloat);
    expect(sides[0]).toBeLessThan(sides[1]!);
    expect(sides[1]).toBeLessThan(sides[2]!);
    expect(sides[2]).toBeLessThan(sides[3]!);

    // More total inset than the linked 2-a-side, so the text fits smaller.
    await expect.poll(() => fontSizePx(page, BODY)).toBeLessThan(linkedSize);

    // --- relink: the linked value was kept, not overwritten ------------------
    await dialog.getByRole("button", { name: "Padding per side" }).click();

    // The two sets are stored separately precisely so this round trip is lossless.
    await expect.poll(padding).toBe(linkedPadding);
    await expect.poll(() => fontSizePx(page, BODY)).toBe(linkedSize);
  });

  test("an outline and a radius reach the painted element", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });
    await dialog.locator(BODY).click();

    // --- radius, in Appearance ----------------------------------------------
    const appearance = section(dialog, "Appearance");
    const radius = row(appearance, "Radius").locator("input");
    await radius.fill("2");
    await radius.press("Tab");

    // Design units are 1% of slide WIDTH, so the px value depends on the canvas
    // size. Asserting "not zero" is the stable claim.
    const painted = await paintedStyle(page, BODY, "border-radius");
    expect(painted).not.toBe("0px");
    expect(parseFloat(painted)).toBeGreaterThan(0);

    // --- outline ------------------------------------------------------------
    await dialog.getByRole("button", { name: "Outline" }).click();
    const outlinePanel = section(dialog, "Outline");
    await row(outlinePanel, "Outline").locator("select").selectOption("on");

    // Strokes render as box-shadow rings rather than CSS borders, so that the
    // element's own geometry is untouched by the outline width.
    await expect
      .poll(() => paintedStyle(page, BODY, "box-shadow"))
      .not.toBe("none");
    expect(await paintedStyle(page, BODY, "border-width")).toBe("0px");

    // Scoped to the Outline panel: Typography also has an "Align" row, and that
    // one is a toggle group with no <select> at all.
    await expect(row(outlinePanel, "Align").locator("select")).toBeVisible();
  });

  test("element opacity fades the whole element, fill opacity only the fill", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });
    await dialog.locator(BODY).click();

    // Two rows are labelled "Opacity" — this one and the Fill section's — so the
    // section scope is what distinguishes them.
    const opacity = row(section(dialog, "Appearance"), "Opacity").locator(
      "input",
    );
    await opacity.fill("50");
    await opacity.press("Tab");

    await expect.poll(() => paintedStyle(page, BODY, "opacity")).toBe("0.5");
  });

  test("the glyph stroke is separate from the element outline", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });
    await dialog.locator(BODY).click();

    await dialog.getByRole("button", { name: "Text effects" }).click();
    const effects = section(dialog, "Text effects");
    await row(effects, "Stroke").locator("select").selectOption("on");

    // -webkit-text-stroke follows the letter shapes; the element outline is a
    // box-shadow ring. Both can be on at once, which is why they are separate
    // controls in separate sections.
    const stroke = await textStyle(page, BODY, "-webkit-text-stroke-width");
    expect(parseFloat(stroke)).toBeGreaterThan(0);

    // Off again leaves no trace.
    await row(effects, "Stroke").locator("select").selectOption("none");
    await expect
      .poll(async () =>
        parseFloat(await textStyle(page, BODY, "-webkit-text-stroke-width")),
      )
      .toBe(0);
  });
});

/**
 * The add-element toolbar floating over the canvas.
 *
 * Ids are asserted literally (`text-1`, `rect-1`, ...) because they are what
 * `freshElementId` promises, and because a document's ids are its stable
 * handles: templates and AI tool calls both address elements by id, so a change
 * in the naming scheme is a change in the contract, not an implementation
 * detail. The Bible template ships `bible-*` ids, so these never collide.
 */
test.describe.serial("Adding elements", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
        e2eCommand.serverCommand("clearBibleData"),
      ]),
  );

  /**
   * The node a shape's appearance is painted on.
   *
   * `paintedStyle` above cannot serve here: it finds the painted node by
   * walking up from `.lay--text-content`, which a shape has none of. Both come
   * down to the same thing — the element renders one level inside the editor's
   * `[data-lay-id]` wrapper, with placement="fill".
   */
  const shapeBody = (dialog: Locator, id: string) =>
    dialog.locator(`[data-lay-id="${id}"] > div`);

  const item = (dialog: Locator, id: string) =>
    dialog.locator(`[data-lay-id="${id}"]`);

  test("adds a text element, selected and ready to restyle", async ({
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });

    await expect(item(dialog, "text-1")).toHaveCount(0);

    await dialog.getByRole("button", { name: "Add text" }).click();

    const added = item(dialog, "text-1");
    await expect(added).toBeVisible();
    await expect(added).toContainText("Your text here");

    // Selected on arrival: adding an element you then have to hunt for and
    // click is a worse experience than not having the button.
    await expect(added).toHaveClass(/lay--editor-item--selected/);

    // ...and the inspector followed the selection, so it can be styled at once.
    // Typography only renders for a selected TEXT element, so its presence
    // proves both the selection and the element's type.
    await expect(dialog.getByText("Typography", { exact: true })).toBeVisible();

    // On top of the paint order. Array order is paint order, so the new
    // element must be the last item in the DOM or it lands behind the
    // full-bleed background and is invisible.
    await expect(dialog.locator(".lay--editor-item").last()).toHaveAttribute(
      "data-lay-id",
      "text-1",
    );
  });

  test("repeated adds cascade instead of stacking invisibly", async ({
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });
    const addText = dialog.getByRole("button", { name: "Add text" });

    await addText.click();
    await expect(item(dialog, "text-1")).toBeVisible();
    const first = await item(dialog, "text-1").boundingBox();

    await addText.click();
    const second = item(dialog, "text-2");
    await expect(second).toBeVisible();

    // Both alive: the second add must not have overwritten the first.
    await expect(item(dialog, "text-1")).toBeVisible();

    // Offset down-right. Were they stacked exactly, the second add would look
    // like the button had done nothing at all.
    const secondBox = await second.boundingBox();
    expect(secondBox!.x).toBeGreaterThan(first!.x);
    expect(secondBox!.y).toBeGreaterThan(first!.y);

    // Only the newest is selected, so the inspector is unambiguous.
    await expect(second).toHaveClass(/lay--editor-item--selected/);
    await expect(dialog.locator(".lay--editor-item--selected")).toHaveCount(1);
  });

  test("an added element survives a save and reopen", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });

    await dialog.getByRole("button", { name: "Add text" }).click();
    await expect(item(dialog, "text-1")).toBeVisible();

    // Give it a value worth checking survived, rather than the placeholder
    // every added element starts with.
    await row(dialog, "X").locator("input").fill("12");
    await row(dialog, "X").locator("input").press("Tab");

    await page.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();

    // The document round-trips through Yjs, which cannot represent
    // `undefined`. A freshly built element carries a dozen nullable fields
    // (name, fill, stroke, spanRoles...), and any one of them left undefined
    // rather than null is dropped in transit — so this is really a test of
    // what `createTextElement` writes.
    await page.getByRole("button", { name: "Style" }).click();
    const reopened = page.getByRole("dialog", { name: "Slide Template" });
    await expect(reopened).toBeVisible();

    const restored = item(reopened, "text-1");
    await expect(restored).toBeVisible();
    await expect(restored).toContainText("Your text here");

    await restored.click();
    await expect(row(reopened, "X").locator("input")).toHaveValue("12");
  });

  test("an added element can be moved, restyled and deleted like any other", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });

    await dialog.getByRole("button", { name: "Add text" }).click();
    const added = item(dialog, "text-1");
    await expect(added).toBeVisible();

    // --- drag, through Moveable ---------------------------------------------
    // Already selected from the add, which is what Selecto gates handing the
    // gesture to Moveable on.
    const before = await added.boundingBox();
    await dragBy(page, added, 0, -60);
    await expect
      .poll(async () => (await added.boundingBox())?.y)
      .toBeLessThan(before!.y);

    // --- restyle ------------------------------------------------------------
    await dialog.getByLabel("Align left").click();
    await expect
      .poll(() => textStyle(page, '[data-lay-id="text-1"]', "text-align"))
      .toBe("left");

    // --- inline edit --------------------------------------------------------
    // The caret lands at the end of the existing text, so this appends.
    await added.dblclick();
    await expect(added).toHaveClass(/lay--editor-item--editing/);
    await page.keyboard.insertText(" and then some");
    await dialog
      .locator(".lay--workbench-canvas")
      .click({ position: { x: 5, y: 5 } });
    await expect(added).not.toHaveClass(/lay--editor-item--editing/);
    await expect(added).toContainText("Your text here and then some");

    // --- delete -------------------------------------------------------------
    await added.click();
    await dialog.getByRole("button", { name: "Delete" }).click();
    await expect(item(dialog, "text-1")).toHaveCount(0);

    // The template's own elements are untouched by the round trip.
    await expect(dialog.locator(BODY)).toBeVisible();
  });

  test("the toolbar does not clear the selection behind it", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });
    const body = dialog.locator(BODY);

    await body.click();
    await expect(body).toHaveClass(/lay--editor-item--selected/);

    // The toolbar sits inside <main>, whose pointerdown handler treats
    // anything outside `.lay--editor` as a click on empty space and clears the
    // selection. Proven with the picture button and a cancelled picker,
    // because that is the one path that ends without selecting something new:
    // every other button would re-select and mask the bug.
    await dialog.getByRole("button", { name: "Add picture" }).click();
    const picker = page.locator('[data-testid="media-picker-dialog"]');
    await expect(picker).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(picker).toBeHidden();

    await expect(body).toHaveClass(/lay--editor-item--selected/);
    // Nothing was added on the way out.
    await expect(item(dialog, "image-1")).toHaveCount(0);
  });

  test("the toolbar clears the slide, so the top row stays clickable", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });

    // The bar is absolutely positioned over the canvas, so without the top
    // padding that makes room for it, it would cover the stage and swallow
    // every click meant for an element in the slide's top strip.
    const bar = await dialog.getByRole("toolbar").boundingBox();
    const stage = await dialog.locator(".lay--editor").boundingBox();
    expect(bar!.y + bar!.height).toBeLessThanOrEqual(stage!.y + 1);

    // Geometry alone would still pass if something else sat over the stage, so
    // this asks the browser what a click at the very top of the slide would
    // actually hit. The background is full-bleed, so its top edge IS the
    // stage's top edge — the most easily covered pixel on the canvas.
    const hit = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return (
          el?.closest("[data-lay-id]")?.getAttribute("data-lay-id") ?? null
        );
      },
      { x: stage!.x + 20, y: stage!.y + 4 },
    );
    expect(hit).toBe("bible-background");
  });

  test("adds a picture as an element in its own right", async ({
    page,
    projectPage,
    loginAndGoToProject,
    uppyUploadFile,
  }) => {
    page.setDefaultTimeout(60000);
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });

    await dialog.getByRole("button", { name: "Add picture" }).click();
    const picker = page.locator('[data-testid="media-picker-dialog"]');
    await expect(picker).toBeVisible();

    await uppyUploadFile("./dummyFiles/dummyImage.jpg");
    // The picker resolves an upload straight into a pick, so it closes itself.
    await expect(picker).toBeHidden({ timeout: 30000 });

    // A picture is not an element TYPE: it is a rect carrying an image fill,
    // which is the same shape the Fill section produces. That is what lets it
    // be cropped, rounded, outlined and rotated with no special cases.
    const added = item(dialog, "image-1");
    await expect(added).toBeVisible();
    await expect(added).toHaveClass(/lay--editor-item--selected/);

    const img = added.locator("img").first();
    await expect(img).toBeVisible();
    // Served from the media route rather than a blob: URL, which is what shows
    // the picture went through the library and will survive a reload.
    await expect(img).toHaveAttribute("src", /\/media\/data\//);

    // Cropped by default, as a picture dropped into a box almost always wants.
    await expect(img).toHaveCSS("object-fit", "cover");
  });
});

/**
 * Keyboard shortcuts.
 *
 * `Meta` is not used anywhere: Playwright's Chromium on Linux does not deliver
 * a Meta chord the way a Mac would, and the handler accepts either modifier, so
 * Control exercises the same branch everywhere.
 */
test.describe.serial("Editor shortcuts", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
        e2eCommand.serverCommand("clearBibleData"),
      ]),
  );

  const item = (dialog: Locator, id: string) =>
    dialog.locator(`[data-lay-id="${id}"]`);

  test("delete and backspace remove the selection, and undo brings it back", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });

    await dialog.getByRole("button", { name: "Add text" }).click();
    await expect(item(dialog, "text-1")).toBeVisible();

    await page.keyboard.press("Delete");
    await expect(item(dialog, "text-1")).toHaveCount(0);

    // Undo restores the element AND its id, since the whole doc is snapshotted.
    await page.keyboard.press("Control+z");
    await expect(item(dialog, "text-1")).toBeVisible();

    await page.keyboard.press("Control+Shift+z");
    await expect(item(dialog, "text-1")).toHaveCount(0);

    // Backspace is the same gesture. Guarded separately because a browser maps
    // it to history-back when nothing swallows it.
    await page.keyboard.press("Control+z");
    await item(dialog, "text-1").click();
    await page.keyboard.press("Backspace");
    await expect(item(dialog, "text-1")).toHaveCount(0);

    // ...and the page did not navigate away under us.
    await expect(dialog).toBeVisible();
  });

  test("delete does nothing while editing text in place", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });
    const body = dialog.locator(BODY);

    await body.dblclick();
    await expect(body).toHaveClass(/lay--editor-item--editing/);

    // Backspace belongs to the caret here. If the shortcut fired instead, the
    // element the user is typing into would vanish mid-sentence.
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Delete");
    await expect(body).toBeVisible();
  });

  test("copy and paste round-trips an element, including its styling", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });

    await dialog.getByRole("button", { name: "Add text" }).click();
    const source = item(dialog, "text-1");
    await expect(source).toBeVisible();

    await dialog.getByLabel("Align left").click();
    await expect
      .poll(() => textStyle(page, '[data-lay-id="text-1"]', "text-align"))
      .toBe("left");

    await page.keyboard.press("Control+c");
    await page.keyboard.press("Control+v");

    // Ids are regenerated against the target doc, so the copy cannot collide
    // with the original it was pasted alongside.
    const copy = item(dialog, "text-2");
    await expect(copy).toBeVisible();
    await expect(source).toBeVisible();
    await expect(copy).toHaveClass(/lay--editor-item--selected/);

    // The payload carries the whole element, not just its geometry.
    await expect
      .poll(() => textStyle(page, '[data-lay-id="text-2"]', "text-align"))
      .toBe("left");

    // Cascaded rather than stacked exactly, so the copy is visibly its own
    // element rather than hiding under the original.
    const sourceBox = await source.boundingBox();
    const copyBox = await copy.boundingBox();
    expect(copyBox!.x).not.toBe(sourceBox!.x);
  });

  test("cut removes the element but keeps it pasteable", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });

    await dialog.getByRole("button", { name: "Add text" }).click();
    await expect(item(dialog, "text-1")).toBeVisible();

    await page.keyboard.press("Control+x");
    await expect(item(dialog, "text-1")).toHaveCount(0);

    // The id is free again by the time it is pasted back, so the round trip is
    // lossless rather than leaving a renamed orphan.
    await page.keyboard.press("Control+v");
    await expect(item(dialog, "text-1")).toBeVisible();
  });

  test("select-all selects every element, and duplicate copies them all", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });

    // The Bible template ships exactly these three.
    await dialog.locator(BODY).click();
    await page.keyboard.press("Control+a");
    await expect(dialog.locator(".lay--editor-item--selected")).toHaveCount(3);

    await page.keyboard.press("Control+d");
    await expect(item(dialog, "bible-body-2")).toBeVisible();
    await expect(item(dialog, "bible-reference-2")).toBeVisible();
    await expect(item(dialog, "bible-background-2")).toBeVisible();

    // Selection follows the copies, which is what makes a duplicate-then-drag
    // work as one gesture.
    await expect(dialog.locator(".lay--editor-item--selected")).toHaveCount(3);
  });
});

/**
 * The compact layout, below the `desktop:` breakpoint (48rem / 768px).
 *
 * `hasTouch` rather than `isMobile`: the latter also fakes a mobile user agent
 * and meta-viewport, and is rejected outright by the Firefox and WebKit
 * drivers. Everything asserted here is about width and input modality, so the
 * narrower switch is the honest one.
 *
 * 390x844 is an iPhone 12. The exact numbers matter less than being under 768
 * and tall enough that a canvas capped at 55% still leaves a usable panel.
 */
test.describe.serial("Layout editor on a phone", () => {
  // Desktop viewport, resized per test. Scene setup CANNOT run at phone width:
  // the remote app ships SidebarWeb and SidebarMobile as two trees toggled with
  // `hidden desktop:flex`, and `createPlugin` drives the web one's add-scene
  // button, which at 390px resolves but is hidden. `hasTouch` stays here
  // because it is a context option and cannot be changed mid-test.
  test.use({ viewport: { width: 1280, height: 720 }, hasTouch: true });

  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
        e2eCommand.serverCommand("clearBibleData"),
      ]),
  );

  const PHONE = { width: 390, height: 844 };

  /**
   * Sets the scene up at desktop width, then shrinks to a phone.
   *
   * Resizing after the dialog is open is deliberate: the workbench reads the
   * breakpoint through matchMedia, so this also proves it reflows live rather
   * than only picking the right layout on mount.
   */
  const openStyleModalOnPhone = async (args: SetupArgs) => {
    const dialog = await openStyleModal(args);
    await args.projectPage.page.setViewportSize(PHONE);
    await expect(dialog.getByRole("tab", { name: "Properties" })).toBeVisible();
    return dialog;
  };

  test("collapses to a canvas over one tabbed panel", async ({
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModalOnPhone({
      loginAndGoToProject,
      projectPage,
    });
    const canvas = dialog.locator(".lay--workbench-canvas");

    // --- both panes reachable, neither beside the canvas --------------------
    const properties = dialog.getByRole("tab", { name: "Properties" });
    const templates = dialog.getByRole("tab", { name: "Templates" });
    await expect(properties).toBeVisible();
    await expect(templates).toBeVisible();

    // Properties opens first: it is what a tap on the canvas leads to.
    await expect(properties).toHaveAttribute("aria-selected", "true");

    // --- the canvas fits, and leaves the panel room ------------------------
    // The desktop build put 450px of fixed rails either side of the canvas,
    // which at this width squeezed it past zero. Nothing may exceed the
    // viewport, and the panel must still be on screen under it.
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox!.width).toBeLessThanOrEqual(PHONE.width);
    // The `max-h-[55%]` cap, which is what keeps a tall slide from pushing the
    // panel off the bottom. +1 absorbs sub-pixel layout rounding.
    expect(canvasBox!.height).toBeLessThanOrEqual(PHONE.height * 0.55 + 1);

    const tabsBox = await properties.boundingBox();
    expect(tabsBox!.y).toBeGreaterThan(canvasBox!.y + canvasBox!.height - 1);
    expect(tabsBox!.y + tabsBox!.height).toBeLessThanOrEqual(PHONE.height);

    // --- the inspector exists exactly once ---------------------------------
    // The house pattern for responsive work renders both a desktop and a
    // mobile tree and hides one with `hidden desktop:flex`. Done here that
    // would duplicate every inspector control, and each `row()` lookup in this
    // file would hit two nodes and fail Playwright's strict mode. This is the
    // assertion that catches a refactor back to that shape.
    await dialog.locator(BODY).tap();
    await expect(dialog.locator(`div:has(> span:text-is("X"))`)).toHaveCount(1);
  });

  test("tapping an element reveals its properties", async ({
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModalOnPhone({
      loginAndGoToProject,
      projectPage,
    });

    // Park on the other tab first, so the switch below is observable.
    await dialog.getByRole("tab", { name: "Templates" }).tap();
    await expect(
      dialog.getByRole("tab", { name: "Templates" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(row(dialog, "X")).toHaveCount(0);

    // Selecting behind a closed tab looks like nothing happening at all, so
    // the selection forces the panel back to Properties.
    await dialog.locator(BODY).tap();
    await expect(dialog.locator(BODY)).toHaveClass(
      /lay--editor-item--selected/,
    );
    await expect(
      dialog.getByRole("tab", { name: "Properties" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(row(dialog, "X").locator("input")).toBeVisible();
  });

  test("the canvas owns touch gestures, except while editing text", async ({
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModalOnPhone({
      loginAndGoToProject,
      projectPage,
    });
    const surface = dialog.locator(".lay--editor-surface");
    const body = dialog.locator(BODY);

    // Without this the browser claims a touch drag for pan/zoom before Selecto
    // or Moveable ever see it. Asserted on computed style because Playwright
    // cannot emulate the native scroll gesture that would show the symptom.
    await expect(surface).toHaveCSS("touch-action", "none");

    // `touch-action` resolves against every ancestor, so `none` on the surface
    // would take caret placement and selection-drag with it. The :has() rule
    // hands the gesture back for the duration of an edit.
    await body.dblclick();
    await expect(body).toHaveClass(/lay--editor-item--editing/);
    await expect(surface).toHaveCSS("touch-action", "auto");

    // ...and reclaims it on commit.
    await dialog.locator(".lay--workbench-canvas").click({
      position: { x: 5, y: 5 },
    });
    await expect(body).not.toHaveClass(/lay--editor-item--editing/);
    await expect(surface).toHaveCSS("touch-action", "none");
  });

  /**
   * A real finger drag.
   *
   * Playwright's touchscreen only taps, so a multi-step gesture has to go
   * through CDP — which is Chromium-only, hence the guard at the call site.
   * Mouse events would not do: they reach Moveable as `pointerType: "mouse"`,
   * so they prove nothing about the touch path.
   */
  const touchDrag = async (
    page: Page,
    from: { x: number; y: number },
    dx: number,
    dy: number,
  ) => {
    const client = await page.context().newCDPSession(page);
    const at = (x: number, y: number) => [{ x, y, radiusX: 12, radiusY: 12 }];

    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: at(from.x, from.y),
    });
    // More than one move: a single jump reads as a tap, not a drag.
    for (const step of [0.34, 0.67, 1]) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: at(from.x + dx * step, from.y + dy * step),
      });
    }
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await client.detach();
  };

  /** Centre of a locator, in viewport coordinates. */
  const centreOf = async (locator: Locator) => {
    const box = await locator.boundingBox();
    if (!box) throw new Error("element has no bounding box");
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };

  test("drag and resize map to stage percentages, not viewport pixels", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModalOnPhone({
      loginAndGoToProject,
      projectPage,
    });
    const reference = dialog.locator(REFERENCE);

    await reference.tap();
    await expect(reference).toHaveClass(/lay--editor-item--selected/);

    // Parked away from both edges first, so neither gesture below runs into
    // clampRect and reports a short delta for a reason unrelated to scaling.
    //
    // The height is not incidental. This element ships ~17px tall at phone
    // width, and the resize dots are 14px straddling each edge, so they very
    // nearly meet in the middle and a centre-grab lands on a handle instead of
    // the body. 20% is ~42px, which clears them.
    const x = row(dialog, "X").locator("input");
    const w = row(dialog, "W").locator("input");
    const h = row(dialog, "H").locator("input");
    await x.fill("30");
    await x.press("Tab");
    await w.fill("40");
    await w.press("Tab");
    await h.fill("20");
    await h.press("Tab");

    const stage = (await dialog.locator(".lay--editor").boundingBox())!;
    const DELTA_PX = 40;
    const expected = (DELTA_PX / stage.width) * 100;

    // The point of running this at phone width: a rect is stored as a
    // percentage of the STAGE, and the stage here is ~374px rather than the
    // ~1000px it gets on desktop, so the same 40px is worth ~10.7% instead of
    // ~4%. Anything measuring against the window or the dialog instead would
    // be out by a multiple. The tolerance is sized to catch that, not to chase
    // sub-pixel drift.
    const startX = Number(await x.inputValue());
    await dragBy(page, reference, DELTA_PX, 0);
    await expect
      .poll(async () => Number(await x.inputValue()))
      .not.toBe(startX);
    expect(
      Math.abs(Number(await x.inputValue()) - startX - expected),
    ).toBeLessThan(1.5);

    const startW = Number(await w.inputValue());
    await dragBy(
      page,
      page.locator(".moveable-control-box .moveable-e"),
      -DELTA_PX,
      0,
    );
    await expect
      .poll(async () => Number(await w.inputValue()))
      .not.toBe(startW);
    expect(
      Math.abs(startW - Number(await w.inputValue()) - expected),
    ).toBeLessThan(1.5);
  });

  test("a finger can move and resize an element", async ({
    page,
    browserName,
    projectPage,
    loginAndGoToProject,
  }) => {
    test.skip(
      browserName !== "chromium",
      "touch gestures are synthesised through CDP",
    );

    const dialog = await openStyleModalOnPhone({
      loginAndGoToProject,
      projectPage,
    });
    const reference = dialog.locator(REFERENCE);

    await reference.tap();
    await expect(reference).toHaveClass(/lay--editor-item--selected/);

    // Height for the same reason as the sibling test: the stock resize dots
    // straddle the edges and would otherwise meet in the middle of this
    // element, so a centre-grab would resize rather than move.
    const y = row(dialog, "Y").locator("input");
    const w = row(dialog, "W").locator("input");
    const h = row(dialog, "H").locator("input");
    await y.fill("40");
    await y.press("Tab");
    await w.fill("40");
    await w.press("Tab");
    await h.fill("20");
    await h.press("Tab");

    // --- move ---------------------------------------------------------------
    // This is what `touch-action: none` buys: without it the browser takes the
    // gesture for panning and Moveable never sees the moves at all, so the
    // element sits still and the failure looks like a broken drag handler.
    const startY = Number(await y.inputValue());
    await touchDrag(page, await centreOf(reference), 0, -50);
    await expect
      .poll(async () => Number(await y.inputValue()))
      .toBeLessThan(startY);

    // --- resize -------------------------------------------------------------
    // Aimed at the handle's centre, so this passes or fails on whether touch
    // drives Moveable — the enlarged hit area is covered separately.
    const handle = page.locator(".moveable-control-box .moveable-e");
    await expect(handle).toBeVisible();

    const startW = Number(await w.inputValue());
    await touchDrag(page, await centreOf(handle), -50, 0);
    await expect
      .poll(async () => Number(await w.inputValue()))
      .toBeLessThan(startW);
  });
});

/**
 * Gradient fills, driven through the Fill section of the inspector.
 *
 * Exercised on the body TEXT element rather than the template's background
 * shape: the background is locked, and a text element ships with `fill: null`,
 * which makes "None" the known starting mode. What is asserted is the painted
 * result, not just the inspector's own state — the schema having a gradient
 * variant means nothing if the renderer drops it.
 */
test.describe.serial("Gradient fill", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
        e2eCommand.serverCommand("clearBibleData"),
      ]),
  );

  const TRACK = ".lay--gradient-track";
  const STOP_ROW = ".lay--gradient-row";

  /** The colour picker's own hex field, one per stop row. */
  const stopHex = (dialog: Locator, index: number) =>
    dialog
      .locator(STOP_ROW)
      .nth(index)
      .locator(".ui--color-picker__external-input");

  const stopPosition = (dialog: Locator, index: number) =>
    dialog.getByLabel(`Stop ${index + 1} position`);

  /** Selects the body text and switches its box fill to a gradient. */
  const openGradient = async (args: SetupArgs) => {
    const dialog = await openStyleModal(args);
    await dialog.locator(BODY).click();
    // Text elements label the section "Box fill" — it is the box behind the
    // glyphs, not the glyph colour, which lives in Typography.
    await expect(dialog.getByText("Box fill", { exact: true })).toBeVisible();

    // exact, because the knobs' own labels start "Gradient stop ...".
    await dialog.getByLabel("Gradient", { exact: true }).click();
    await expect(dialog.locator(STOP_ROW)).toHaveCount(2);
    return dialog;
  };

  test("switching modes paints the fill and carries the colour across", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });
    await dialog.locator(BODY).click();
    await expect(dialog.getByText("Box fill", { exact: true })).toBeVisible();

    // --- none ---------------------------------------------------------------
    expect(await paintedStyle(page, BODY, "background-image")).toBe("none");

    // --- gradient -----------------------------------------------------------
    await dialog.getByLabel("Gradient", { exact: true }).click();
    await expect
      .poll(() => paintedStyle(page, BODY, "background-image"))
      .toContain("linear-gradient");

    // The seeded ramp. Black is the fallback for an element that had no fill.
    await expect(dialog.locator(STOP_ROW)).toHaveCount(2);
    await expect(stopHex(dialog, 0)).toHaveValue("#000000");
    await expect(stopHex(dialog, 1)).toHaveValue("#FFFFFF");
    await expect(stopPosition(dialog, 0)).toHaveValue("0");
    await expect(stopPosition(dialog, 1)).toHaveValue("100");

    // --- gradient collapses to its first stop -------------------------------
    // Solid paints through background-color, so background-image goes back to
    // none. Flipping modes is how a design gets explored, and resetting the
    // colour to a default each time would make that a chore.
    await dialog.getByLabel("Solid", { exact: true }).click();
    await expect
      .poll(() => paintedStyle(page, BODY, "background-color"))
      .toBe("rgb(0, 0, 0)");

    // --- and back, with the solid colour seeding the first stop -------------
    await dialog.getByLabel("Gradient", { exact: true }).click();
    await expect(stopHex(dialog, 0)).toHaveValue("#000000");

    // --- none clears it -----------------------------------------------------
    await dialog.getByLabel("None", { exact: true }).click();
    await expect
      .poll(() => paintedStyle(page, BODY, "background-image"))
      .toBe("none");
    await expect(dialog.locator(STOP_ROW)).toHaveCount(0);
  });

  test("clicking the ramp adds a stop, and dragging a knob moves it", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openGradient({ loginAndGoToProject, projectPage });
    const track = dialog.locator(TRACK);

    // --- click to add -------------------------------------------------------
    // Lands at the click point, taking the colour the ramp already shows there,
    // so inserting a stop changes nothing until it is moved or recoloured.
    // Halfway along black -> white is mid grey.
    await track.click();
    await expect(dialog.locator(STOP_ROW)).toHaveCount(3);
    await expect(stopPosition(dialog, 1)).toHaveValue("50");
    await expect(stopHex(dialog, 1)).toHaveValue("#808080");

    // --- drag a knob --------------------------------------------------------
    // Offsets are a fraction of the TRACK, so the same 60px is worth a
    // different percentage at every panel width. Anything measuring against the
    // window or the dialog would be out by a multiple.
    const trackBox = (await track.boundingBox())!;
    const DELTA_PX = 60;
    const expected = Math.round((DELTA_PX / trackBox.width) * 100);

    await dragBy(page, dialog.getByLabel(/^Gradient stop 1,/), DELTA_PX, 0);

    await expect
      .poll(async () => Number(await stopPosition(dialog, 0).inputValue()))
      .toBeGreaterThan(0);
    // Tolerance absorbs the 1% quantisation, not a scaling mistake.
    expect(
      Math.abs(Number(await stopPosition(dialog, 0).inputValue()) - expected),
    ).toBeLessThanOrEqual(2);
  });

  test("stops reach CSS in ascending order however they are reordered", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openGradient({ loginAndGoToProject, projectPage });

    await dialog.locator(TRACK).click();
    await expect(stopHex(dialog, 1)).toHaveValue("#808080");

    // Push the black stop past the grey one by typing, which is the cheapest
    // way to force a reorder.
    await stopPosition(dialog, 0).fill("70");
    await stopPosition(dialog, 0).press("Tab");

    // The rows re-sort, and each stop keeps its own colour through the move.
    await expect(stopPosition(dialog, 0)).toHaveValue("50");
    await expect(stopHex(dialog, 0)).toHaveValue("#808080");
    await expect(stopPosition(dialog, 1)).toHaveValue("70");
    await expect(stopHex(dialog, 1)).toHaveValue("#000000");
    await expect(stopPosition(dialog, 2)).toHaveValue("100");

    // The reason any of this matters: CSS silently CLAMPS a stop whose offset
    // is below its predecessor's, so an unsorted array renders as a flat band
    // with no error anywhere. Grey must reach the browser before black.
    const painted = await paintedStyle(page, BODY, "background-image");
    expect(painted).toContain("linear-gradient");
    expect(painted.indexOf("128, 128, 128")).toBeGreaterThan(-1);
    expect(painted.indexOf("128, 128, 128")).toBeLessThan(
      painted.indexOf("rgb(0, 0, 0)"),
    );
  });

  test("the list keeps a floor of two stops, and reverse flips the ramp", async ({
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openGradient({ loginAndGoToProject, projectPage });

    // --- the floor ----------------------------------------------------------
    // One stop is not a gradient, and leaves the renderer nothing to
    // interpolate between.
    await expect(dialog.getByLabel("Remove stop 1")).toBeDisabled();
    await expect(dialog.getByLabel("Remove stop 2")).toBeDisabled();

    await dialog.getByLabel("Add a stop").click();
    await expect(dialog.locator(STOP_ROW)).toHaveCount(3);
    // Dropped into the widest gap, so it is somewhere useful and visible.
    await expect(stopPosition(dialog, 1)).toHaveValue("50");
    await expect(dialog.getByLabel("Remove stop 1")).toBeEnabled();

    // --- reverse ------------------------------------------------------------
    await dialog.getByLabel("Reverse the gradient").click();
    await expect(stopHex(dialog, 0)).toHaveValue("#FFFFFF");
    await expect(stopHex(dialog, 2)).toHaveValue("#000000");
    // Mirrored offsets, so a symmetric ramp keeps its stop positions.
    await expect(stopPosition(dialog, 0)).toHaveValue("0");
    await expect(stopPosition(dialog, 1)).toHaveValue("50");
    await expect(stopPosition(dialog, 2)).toHaveValue("100");

    // --- removing returns to the floor --------------------------------------
    await dialog.getByLabel("Remove stop 2").click();
    await expect(dialog.locator(STOP_ROW)).toHaveCount(2);
    await expect(dialog.getByLabel("Remove stop 1")).toBeDisabled();
  });

  test("the angle writes through to the painted gradient", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openGradient({ loginAndGoToProject, projectPage });

    // 90deg, not the 180 default: Chrome serialises `linear-gradient(180deg,
    // ...)` without the angle, since to-bottom is the CSS default, so the
    // default would prove nothing about the value reaching the browser.
    const angle = row(dialog, "Angle").locator("input");
    await angle.fill("90");
    await angle.press("Tab");

    await expect
      .poll(() => paintedStyle(page, BODY, "background-image"))
      .toContain("90deg");
  });
});

/**
 * Picture fills.
 *
 * A picture is a FILL, not an element type, so these run against the ordinary
 * background shape: the point of the design is that any element can hold one.
 *
 * Each test uploads through the picker's own Dropzone rather than seeding the
 * library, because the upload path is what produces a real `mediaName`, and the
 * mediaName -> {mediaId, extension} conversion is the part most likely to break
 * silently — a stored absolute URL would still render here and only fail later,
 * on another host.
 */
test.describe.serial("Picture fill", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
        e2eCommand.serverCommand("clearBibleData"),
      ]),
  );

  const PICKER = '[data-testid="media-picker-dialog"]';
  const IMAGE = "./dummyFiles/dummyImage.jpg";

  /** The <img> the FillLayer draws inside an element. */
  const fillImage = (page: Page, elementSelector: string) =>
    page.locator(`${elementSelector} img`).first();

  /** Selects the body text and opens the picker from its fill controls. */
  const openPicker = async (page: Page, dialog: Locator) => {
    await dialog.locator(BODY).click();
    // Text calls it "Box fill" — the box behind the glyphs, not the glyph
    // colour, which lives in Typography.
    await expect(dialog.getByText("Box fill", { exact: true })).toBeVisible();
    await dialog.getByLabel("Image", { exact: true }).click();
    await expect(page.locator(PICKER)).toBeVisible();
  };

  test("uploading through the picker fills the element with the picture", async ({
    page,
    projectPage,
    loginAndGoToProject,
    uppyUploadFile,
  }) => {
    page.setDefaultTimeout(60000);
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });

    // Nothing is painted yet.
    await expect(page.locator(`${BODY} img`)).toHaveCount(0);

    await openPicker(page, dialog);
    await uppyUploadFile(IMAGE);

    // The picker resolves an upload straight into a pick, so it closes itself.
    await expect(page.locator(PICKER)).toBeHidden({ timeout: 30000 });

    const img = fillImage(page, BODY);
    await expect(img).toBeVisible();

    // Served from the media route, not a blob: or data: URL, which is what
    // proves the picture went through the library rather than staying local.
    await expect(img).toHaveAttribute("src", /\/media\/data\//);

    // The fill is an image, so no colour may be painted underneath it: a solid
    // background would hide a transparent PNG's transparency.
    await expect
      .poll(() => paintedStyle(page, BODY, "background-image"))
      .toBe("none");
  });

  test("the picture survives a reopen, so what was stored is a durable reference", async ({
    page,
    projectPage,
    loginAndGoToProject,
    uppyUploadFile,
  }) => {
    page.setDefaultTimeout(60000);
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });

    await openPicker(page, dialog);
    await uppyUploadFile(IMAGE);
    await expect(page.locator(PICKER)).toBeHidden({ timeout: 30000 });
    await expect(fillImage(page, BODY)).toBeVisible();

    // Save, close, reopen. The doc round-trips through Yjs, which cannot store
    // `undefined` — a fill whose src came back malformed shows up here.
    await page.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Style" }).click();
    const reopened = page.getByRole("dialog", { name: "Slide Template" });
    await expect(reopened).toBeVisible();

    const img = fillImage(page, BODY);
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute("src", /\/media\/data\//);

    // Still an image fill, with its controls, rather than having decayed to a
    // colour on the way through.
    await reopened.locator(BODY).click();
    await expect(row(reopened, "Fit")).toBeVisible();
  });

  test("fit and opacity reach the rendered picture", async ({
    page,
    projectPage,
    loginAndGoToProject,
    uppyUploadFile,
  }) => {
    page.setDefaultTimeout(60000);
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });

    await openPicker(page, dialog);
    await uppyUploadFile(IMAGE);
    await expect(page.locator(PICKER)).toBeHidden({ timeout: 30000 });

    const img = fillImage(page, BODY);
    await expect(img).toBeVisible();

    // --- fit ----------------------------------------------------------------
    // "cover" is the default, since a background almost always wants cropping.
    await expect(img).toHaveCSS("object-fit", "cover");

    await dialog.getByLabel("Fit", { exact: true }).click();
    await expect(img).toHaveCSS("object-fit", "contain");

    await dialog.getByLabel("Stretch", { exact: true }).click();
    await expect(img).toHaveCSS("object-fit", "fill");

    // --- opacity ------------------------------------------------------------
    // Applied to the fill LAYER, not the element: fading the element itself
    // would fade the text sitting on top of it too. Scoped to the fill section
    // because Appearance has an "Opacity" row that does the other thing.
    const opacity = row(section(dialog, "Box fill"), "Opacity").locator(
      "input",
    );
    await opacity.fill("40");
    await opacity.press("Tab");

    const layer = page.locator(`${BODY} img`).first().locator("..");
    await expect(layer).toHaveCSS("opacity", "0.4");
    expect(await paintedStyle(page, BODY, "opacity")).toBe("1");
  });

  test("cancelling the picker leaves the existing fill alone", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });

    // Give the background a colour worth protecting.
    await dialog.locator(BODY).click();
    await dialog.getByLabel("Solid", { exact: true }).click();
    await expect
      .poll(() => paintedStyle(page, BODY, "background-color"))
      .not.toBe("rgba(0, 0, 0, 0)");

    const before = await paintedStyle(page, BODY, "background-color");

    // Open the picker and dismiss it without choosing anything. An image fill
    // written optimistically here would leave a fill with no source, which
    // renders as an empty box rather than the colour that was there.
    await dialog.getByLabel("Image", { exact: true }).click();
    await expect(page.locator(PICKER)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(PICKER)).toBeHidden();

    await expect(page.locator(`${BODY} img`)).toHaveCount(0);
    expect(await paintedStyle(page, BODY, "background-color")).toBe(before);

    // The inspector agrees: still a solid, so the toggle did not stick on
    // "Image" after the cancel.
    await expect(row(dialog, "Colour")).toBeVisible();
  });

  test("switching to a colour drops the picture", async ({
    page,
    projectPage,
    loginAndGoToProject,
    uppyUploadFile,
  }) => {
    page.setDefaultTimeout(60000);
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });

    await openPicker(page, dialog);
    await uppyUploadFile(IMAGE);
    await expect(page.locator(PICKER)).toBeHidden({ timeout: 30000 });
    await expect(fillImage(page, BODY)).toBeVisible();

    await dialog.getByLabel("Gradient", { exact: true }).click();

    // The layer goes away entirely rather than lingering under the gradient.
    await expect(page.locator(`${BODY} img`)).toHaveCount(0);
    await expect
      .poll(() => paintedStyle(page, BODY, "background-image"))
      .toContain("linear-gradient");
  });
});

/**
 * Video fills.
 *
 * Like pictures, a video is a FILL rather than an element type, so these run
 * against the same body text element.
 *
 * Videos are slower and stranger to test than pictures: an upload has to be
 * TRANSCODED before the picker will hand it back, and that is an ffmpeg run per
 * upload. So exactly ONE test here uploads for real — the one whose subject is
 * the upload path itself, and which therefore has to see the real
 * InternalVideo the picker builds, hlsMediaName and all.
 *
 * Every other test only needs "a video the picker will hand back", so it seeds
 * one through `seedVideoMedia`: the bytes are written straight to the library
 * with the `completed` transcode metadata hand-written, which is exactly what
 * the picker gates selectability on. Those videos have no HLS ladder and play
 * the raw mp4 instead, which is a real code path (`useVideoUrl` falls back to
 * `url` when `hlsMediaName` is null) and irrelevant to what they assert.
 */
test.describe.serial("Video fill", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
        e2eCommand.serverCommand("clearBibleData"),
      ]),
  );

  const PICKER = '[data-testid="media-picker-dialog"]';
  const VIDEO = "./dummyFiles/dummyVideo.mp4";
  /**
   * Poster for a seeded video. Any image would do — it is only ever the frame
   * shown before playback starts — but this one is 389px wide, which is what
   * lets the placeholder test see a genuine 320px resize rather than the
   * redirect-to-original the processed route serves for narrower sources.
   */
  const POSTER = "./dummyFiles/dummyImage.jpg";
  /** dummyVideo.mp4's real length. The player treats an unknown one as stopped. */
  const VIDEO_DURATION = 6.2;

  /** Transcoding is the slow part, and it gates the one test that uploads. */
  const TRANSCODE_TIMEOUT = 180000;

  /** The <video> react-player mounts inside the fill layer. */
  const fillVideo = (page: Page, elementSelector: string) =>
    page.locator(`${elementSelector} video`).first();

  /** Selects the body text and opens the picker from its fill controls. */
  const openPicker = async (page: Page, dialog: Locator) => {
    await dialog.locator(BODY).click();
    await expect(dialog.getByText("Box fill", { exact: true })).toBeVisible();
    await dialog.getByLabel("Video", { exact: true }).click();
    await expect(page.locator(PICKER)).toBeVisible();
  };

  /**
   * Uploads a video through the picker, waits out transcoding, and picks it.
   *
   * The pick is deliberately manual. A video is only selectable once the server
   * has transcoded it, and that is the whole point: an auto-picked upload comes
   * back with no HLS source, no poster and no duration, and the player treats a
   * video of unknown duration as not playing. Waiting for the card to become
   * clickable is what proves we stored a COMPLETE video.
   */
  const uploadVideo = async (
    page: Page,
    upload: (fileName: string) => void,
  ) => {
    await upload(VIDEO);

    const card = page
      .locator(PICKER)
      .locator(".bp--media-card")
      .filter({ hasText: "dummyVideo.mp4" });

    // Present as soon as the upload lands, but not yet selectable.
    await expect(card).toBeVisible({ timeout: 60000 });

    // The picker disables a video until it is transcoded (isVideoReady), so
    // this class going away is precisely the "ready to pick" signal.
    await expect(card).not.toHaveClass(/bp--media-card--disabled/, {
      timeout: TRANSCODE_TIMEOUT,
    });

    await card.click();
    await expect(page.locator(PICKER)).toBeHidden();
  };

  /**
   * Seeds a transcoded video into the library and picks it, no ffmpeg involved.
   *
   * Seeded AFTER the scene setup, because that is what creates the org the
   * media hangs off. The disabled-class assertion is not ceremony: it is the
   * proof that a seeded video really does read as ready, so a regression in
   * `isVideoReady` cannot quietly turn these tests into a test of nothing.
   */
  const useSeededVideo = async (
    page: Page,
    dialog: Locator,
    e2eCommand: E2ECommandAPI,
  ) => {
    await e2eCommand.seedVideoMedia({
      orgSlug: "testorg",
      videoPath: VIDEO,
      posterPath: POSTER,
      duration: VIDEO_DURATION,
    });

    await openPicker(page, dialog);

    const card = page
      .locator(PICKER)
      .locator(".bp--media-card")
      .filter({ hasText: "dummyVideo.mp4" });

    await expect(card).toBeVisible();
    await expect(card).not.toHaveClass(/bp--media-card--disabled/);

    await card.click();
    await expect(page.locator(PICKER)).toBeHidden();
  };

  test("uploading through the picker fills the element with the video", async ({
    page,
    projectPage,
    loginAndGoToProject,
    uppyUploadFile,
  }) => {
    test.setTimeout(TRANSCODE_TIMEOUT + 60000);
    page.setDefaultTimeout(60000);
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });

    // Nothing is playing yet.
    await expect(page.locator(`${BODY} video`)).toHaveCount(0);

    await openPicker(page, dialog);
    await uploadVideo(page, uppyUploadFile);

    const video = fillVideo(page, BODY);
    await expect(video).toBeVisible();

    // Muted and looping: a background that blares audio over the service, or
    // stops dead after 20 seconds, is not a background.
    await expect(video).toHaveJSProperty("muted", true);
    await expect(video).toHaveJSProperty("loop", true);

    // It actually plays, rather than mounting paused on the first frame.
    await expect
      .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime), {
        timeout: 30000,
      })
      .toBeGreaterThan(0);

    // A video fill paints no colour underneath, for the same reason a picture
    // does not: the fill IS the video.
    await expect
      .poll(() => paintedStyle(page, BODY, "background-image"))
      .toBe("none");
  });

  test("the video survives a reopen, so what was stored is a durable reference", async ({
    page,
    projectPage,
    loginAndGoToProject,
    e2eCommand,
  }) => {
    page.setDefaultTimeout(60000);
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });

    await useSeededVideo(page, dialog, e2eCommand);
    await expect(fillVideo(page, BODY)).toBeVisible();

    // Save, close, reopen. A video stores a whole object rather than a single
    // URL, and Yjs cannot hold `undefined` — a field that went missing on the
    // way through shows up here as a fill that no longer plays.
    await page.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Style" }).click();
    const reopened = page.getByRole("dialog", { name: "Slide Template" });
    await expect(reopened).toBeVisible();

    await expect(fillVideo(page, BODY)).toBeVisible();

    // Still a video fill, with its controls, rather than having decayed to a
    // colour or a still picture on the way through.
    await reopened.locator(BODY).click();
    await expect(row(reopened, "Video")).toBeVisible();
    await expect(row(reopened, "Fit")).toBeVisible();
  });

  test("fit and opacity reach the rendered video", async ({
    page,
    projectPage,
    loginAndGoToProject,
    e2eCommand,
  }) => {
    page.setDefaultTimeout(60000);
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });

    await useSeededVideo(page, dialog, e2eCommand);

    const video = fillVideo(page, BODY);
    await expect(video).toBeVisible();

    // --- fit ----------------------------------------------------------------
    // react-player owns the <video>, so fit is delivered through a CSS custom
    // property rather than an inline style. That indirection is exactly what
    // could silently stop working, so assert the COMPUTED result.
    await expect(video).toHaveCSS("object-fit", "cover");

    await dialog.getByLabel("Fit", { exact: true }).click();
    await expect(video).toHaveCSS("object-fit", "contain");

    await dialog.getByLabel("Stretch", { exact: true }).click();
    await expect(video).toHaveCSS("object-fit", "fill");

    // --- opacity ------------------------------------------------------------
    // On the fill layer, not the element: fading the element would fade the
    // text sitting on top of the video too. Scoped to the fill section because
    // Appearance has an "Opacity" row that does the other thing.
    const opacity = row(section(dialog, "Box fill"), "Opacity").locator(
      "input",
    );
    await opacity.fill("40");
    await opacity.press("Tab");

    const layer = page
      .locator(`${BODY} .lay--video-fill`)
      .first()
      .locator("..");
    await expect(layer).toHaveCSS("opacity", "0.4");
    expect(await paintedStyle(page, BODY, "opacity")).toBe("1");
  });

  test("cancelling the picker leaves the existing fill alone", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });

    await dialog.locator(BODY).click();
    await dialog.getByLabel("Solid", { exact: true }).click();
    await expect
      .poll(() => paintedStyle(page, BODY, "background-color"))
      .not.toBe("rgba(0, 0, 0, 0)");

    const before = await paintedStyle(page, BODY, "background-color");

    // A video fill written optimistically on open would leave a fill with no
    // video in it, which renders as an empty box rather than the colour that
    // was there.
    await dialog.getByLabel("Video", { exact: true }).click();
    await expect(page.locator(PICKER)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(PICKER)).toBeHidden();

    await expect(page.locator(`${BODY} video`)).toHaveCount(0);
    expect(await paintedStyle(page, BODY, "background-color")).toBe(before);

    await expect(row(dialog, "Colour")).toBeVisible();
  });

  test("switching to a colour drops the video", async ({
    page,
    projectPage,
    loginAndGoToProject,
    e2eCommand,
  }) => {
    page.setDefaultTimeout(60000);
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });

    await useSeededVideo(page, dialog, e2eCommand);
    await expect(fillVideo(page, BODY)).toBeVisible();

    await dialog.getByLabel("Solid", { exact: true }).click();

    // The player unmounts entirely. A <video> left alive under an opaque
    // colour is invisible but still decoding, which is the expensive way to
    // get this wrong.
    await expect(page.locator(`${BODY} video`)).toHaveCount(0);
    await expect
      .poll(() => paintedStyle(page, BODY, "background-color"))
      .not.toBe("rgba(0, 0, 0, 0)");
  });

  test("a poster covers the gap while the video loads", async ({
    page,
    projectPage,
    loginAndGoToProject,
    e2eCommand,
  }) => {
    page.setDefaultTimeout(60000);
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });

    const processed: string[] = [];
    page.on("response", (r) => {
      if (r.url().includes("/media/processed/")) processed.push(r.url());
    });

    await useSeededVideo(page, dialog, e2eCommand);

    const placeholder = page.locator(`${BODY} .lay--video-placeholder`);
    await expect(placeholder).toBeAttached();

    // The SMALL processed variant, not the full poster. Loading a full-size
    // image to cover a brief gap would defeat the point. Polled because
    // naturalWidth stays 0 until the image has actually decoded.
    await expect
      .poll(
        () => placeholder.evaluate((el: HTMLImageElement) => el.naturalWidth),
        { timeout: 15000 },
      )
      .toBe(320);
    expect(processed.some((u) => u.includes("/media/processed/320/"))).toBe(
      true,
    );

    // It gets out of the way once there is a real frame to show. Polled rather
    // than asserted once, because the handover is what we care about and it may
    // already have happened by the time we look.
    await expect
      .poll(
        () =>
          placeholder.evaluate((el) => getComputedStyle(el).opacity as string),
        { timeout: 30000 },
      )
      .toBe("0");

    // ...and only once a frame genuinely exists. readyState >= HAVE_CURRENT_DATA
    // is the real signal; react-player's own `onReady` fires on `loadstart`,
    // before anything is decoded, so wiring the placeholder to that would hide
    // it while the element is still transparent — which is the exact flash this
    // placeholder exists to prevent.
    const readyState = await fillVideo(page, BODY).evaluate(
      (el: HTMLVideoElement) => el.readyState,
    );
    expect(readyState).toBeGreaterThanOrEqual(2);
  });

  test("the editing canvas plays, while the remote's slide previews do not", async ({
    page,
    projectPage,
    loginAndGoToProject,
    e2eCommand,
  }) => {
    page.setDefaultTimeout(60000);
    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });

    await useSeededVideo(page, dialog, e2eCommand);

    // The canvas is where you frame the video, so it plays. Asserted on
    // currentTime rather than just presence: this is the one place a seeded
    // video's mp4 playback is proven, the upload test above covering the HLS
    // source in the same way.
    const video = fillVideo(page, BODY);
    await expect(video).toBeVisible();
    await expect
      .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime), {
        timeout: 30000,
      })
      .toBeGreaterThan(0);

    await page.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();

    // Add a passage so the remote renders the doc through LayoutRenderer.
    await page.getByTestId("bible-search-input").fill("John 3:16");
    await page.getByTestId("bible-search-add").click();
    await expect(page.getByText("John 3:16").first()).toBeVisible();

    const preview = page.locator(".lay--stage").first();
    await expect(preview).toBeVisible();

    // The remote shows every slide at once, so previews draw the poster frame
    // rather than spinning up a decoder each. Without this the slide grid runs
    // one video per slide, which is invisible in a screenshot and expensive in
    // practice.
    await expect(preview.locator("img")).toHaveCount(1);
    await expect(preview.locator("video, hls-video")).toHaveCount(0);
  });
});
