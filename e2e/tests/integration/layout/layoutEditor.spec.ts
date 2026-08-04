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
