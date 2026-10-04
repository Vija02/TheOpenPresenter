import type { LayoutDoc } from "@repo/layout";
import {
  createLayoutDoc,
  createShapeElement,
  createTextElement,
  solidPaint,
} from "@repo/layout";

import { expect, test } from "../../../../../fixtures/projectFixture";
import { buildGoogleSlidesScene } from "../../../../../helpers/slidesSeed";

const deckDoc = (
  label: string,
  background: string,
  aspectRatio?: { width: number; height: number },
): LayoutDoc =>
  createLayoutDoc({
    ...(aspectRatio ? { aspectRatio } : {}),
    elements: [
      createShapeElement({
        id: "bg",
        kind: "rect",
        rect: { x: 0, y: 0, w: 100, h: 100 },
        fill: solidPaint(background),
        locked: true,
      }),
      createTextElement({
        id: "title",
        content: label,
        rect: { x: 10, y: 30, w: 80, h: 40 },
        style: { fontSize: 10, align: "center", valign: "center" },
      }),
    ],
  });

const buildCustomScene = ({
  importId,
  docs,
  notes,
}: {
  importId: string;
  docs: LayoutDoc[];
  notes: string[];
}) => ({
  pluginName: "slides",
  name: "Slides",
  activate: true,
  pluginData: {
    imports: {
      [importId]: {
        importId,
        type: "custom",
        name: "E2E Custom",
        fetchId: `fetch_${importId}`,
        thumbnailLinks: [],
        slideClickCounts: docs.map(() => 0),
        slideIds: docs.map((_, i) => `${importId}-slide-${i}`),
        speakerNotes: notes,
        docs,
        _isFetching: false,
      },
    },
    slideOrder: docs.map((_, i) => `${importId}:${i}`),
  },
  rendererPluginData: {
    currentSlideIndex: 0,
    currentClickCount: 0,
    lastClickTimestamp: null,
  },
});

const NOTES = ["Custom notes one", "Custom notes two", "Custom notes three"];

const customScene = buildCustomScene({
  importId: "import_e2ecustom",
  docs: [
    deckDoc("Slide 1", "#1d4ed8"),
    deckDoc("Slide 2", "#047857"),
    deckDoc("Slide 3", "#b91c1c"),
  ],
  notes: NOTES,
});

const customScene43 = buildCustomScene({
  importId: "import_e2e43",
  docs: [
    deckDoc("Slide 1", "#1d4ed8", { width: 4, height: 3 }),
    deckDoc("Slide 2", "#047857", { width: 4, height: 3 }),
    deckDoc("Slide 3", "#b91c1c", { width: 4, height: 3 }),
  ],
  notes: NOTES,
});

const GOOGLE_SCENE = buildGoogleSlidesScene();

test.describe("Slides speaker view", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
      ]),
  );

  test("shows main slide, prev/next previews and notes, and navigates", async ({
    page,
    e2eCommand,
  }) => {
    await e2eCommand.loginWithScenes({
      next: "/o/testorg",
      orgs: [
        {
          name: "TestOrg",
          slug: "testorg",
          projects: [
            {
              name: "TestProject",
              slug: "testproject",
              scenes: [customScene],
            },
          ],
        },
      ],
    });
    await page.goto("/app/testorg/testproject");

    await page.getByRole("button", { name: "Speaker view" }).click();

    await expect(page.getByText("Speaker notes")).toBeVisible();
    await expect(page.getByText("1 / 3")).toBeVisible();
    await expect(page.getByText("Custom notes one")).toBeVisible();
    await expect(page.getByTitle("Pause timer")).toBeVisible();

    // Slide 1 has nothing before it; the next tile shows slide 2.
    await expect(page.getByText("Start of slides")).toBeVisible();
    await expect(
      page.getByTestId("speaker-next-box").locator(".lay--stage").first(),
    ).toBeVisible();

    // Arrow keys are forwarded by the remote shell: one press, one slide.
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("2 / 3")).toBeVisible();
    await expect(page.getByText("Custom notes two")).toBeVisible();
    await expect(page.getByText("Start of slides")).toBeHidden();

    // Navigate with the Next preview thumbnail.
    await page.getByText("Next").click();
    await expect(page.getByText("3 / 3")).toBeVisible();
    await expect(page.getByText("Custom notes three")).toBeVisible();

    await page.getByTitle("Close speaker view").click();
    await expect(page.getByText("Speaker notes")).toBeHidden();
  });

  test("pins the previews to the deck's aspect ratio", async ({
    page,
    e2eCommand,
  }) => {
    await e2eCommand.loginWithScenes({
      next: "/o/testorg",
      orgs: [
        {
          name: "TestOrg",
          slug: "testorg",
          projects: [
            {
              name: "TestProject",
              slug: "testproject",
              scenes: [customScene43],
            },
          ],
        },
      ],
    });
    await page.goto("/app/testorg/testproject");
    await page.getByRole("button", { name: "Speaker view" }).click();
    await expect(page.getByText("1 / 3")).toBeVisible();

    const ratioOf = async (testId: string) => {
      const box = await page.getByTestId(testId).boundingBox();
      expect(box).not.toBeNull();
      return box!.width / box!.height;
    };

    // A 4:3 deck. Slide 1 has no previous slide, so move to slide 2 where the
    // previous and next tiles both hold a real slide.
    expect(await ratioOf("speaker-main-box")).toBeCloseTo(4 / 3, 1);

    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("2 / 3")).toBeVisible();
    expect(await ratioOf("speaker-main-box")).toBeCloseTo(4 / 3, 1);
    expect(await ratioOf("speaker-previous-box")).toBeCloseTo(4 / 3, 1);
    expect(await ratioOf("speaker-next-box")).toBeCloseTo(4 / 3, 1);
  });

  test("renders on a narrow phone viewport", async ({ page, e2eCommand }) => {
    await e2eCommand.loginWithScenes({
      next: "/o/testorg",
      orgs: [
        {
          name: "TestOrg",
          slug: "testorg",
          projects: [
            {
              name: "TestProject",
              slug: "testproject",
              scenes: [customScene],
            },
          ],
        },
      ],
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/app/testorg/testproject");

    await page.getByRole("button", { name: "Speaker view" }).click();
    await expect(page.getByText("1 / 3")).toBeVisible();

    const box = await page.getByTestId("speaker-main-box").boundingBox();
    expect(box!.width).toBeLessThanOrEqual(390);
    expect(box!.width / box!.height).toBeCloseTo(16 / 9, 1);
  });

  test("notes follow the displayed slide, including across a build", async ({
    page,
    e2eCommand,
  }) => {
    await e2eCommand.loginWithScenes({
      next: "/o/testorg",
      orgs: [
        {
          name: "TestOrg",
          slug: "testorg",
          projects: [
            {
              name: "TestProject",
              slug: "testproject",
              scenes: [GOOGLE_SCENE],
            },
          ],
        },
      ],
    });
    await page.goto("/app/testorg/testproject");
    await page.getByRole("button", { name: "Speaker view" }).click();

    await expect(page.getByText("Notes for slide one")).toBeVisible();

    const sampleImport = Object.values(GOOGLE_SCENE.pluginData.imports)[0] as {
      slideClickCounts: number[];
    };
    expect(sampleImport.slideClickCounts[0]).toBeGreaterThan(0);

    // The first slide has a click build: ArrowRight plays it, and the
    // displayed slide (and its notes) stay put.
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("Notes for slide one")).toBeVisible();

    // With the build shown, the Next tile is the next slide, and the notes
    // move with it.
    const nextTile = page.getByTestId("speaker-next-box").locator("..");
    await expect(nextTile).toHaveText(/Next\s*2$/);
    await nextTile.click();
    await expect(page.getByText("Notes for slide two")).toBeVisible();
  });

  test("previews picture the step a press would land on", async ({
    page,
    e2eCommand,
  }) => {
    await e2eCommand.loginWithScenes({
      next: "/o/testorg",
      orgs: [
        {
          name: "TestOrg",
          slug: "testorg",
          projects: [
            {
              name: "TestProject",
              slug: "testproject",
              scenes: [GOOGLE_SCENE],
            },
          ],
        },
      ],
    });
    await page.goto("/app/testorg/testproject");
    await page.getByRole("button", { name: "Speaker view" }).click();

    // Every step is captured from a hidden embed, which then goes away
    await expect(page.getByTestId("slide-capturer")).toHaveCount(0, {
      timeout: 60_000,
    });

    const previousTile = page.getByTestId("speaker-previous-box").locator("..");
    const nextTile = page.getByTestId("speaker-next-box").locator("..");
    const captured = (tile: typeof nextTile) =>
      tile.getByTestId("speaker-captured-step").locator("svg");

    // Slide 1 has one build: Next is that build, not slide 2
    await expect(nextTile).toHaveText(/Next\s*1$/);
    await expect(captured(nextTile)).toHaveCount(1);
    await expect(previousTile).toHaveText(/Start of slides/);

    // Each press waits out the step, so the next one isn't a skip
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(1500);
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("2 / 4")).toBeVisible();
    await page.waitForTimeout(1500);

    // Slide 2 has an object that plays on entry: Previous is slide 2
    // without it, reachable only by going back
    await expect(previousTile).toHaveText(/Previous\s*2$/);
    await expect(captured(previousTile)).toHaveCount(1);

    await previousTile.click();
    await expect(previousTile).toHaveText(/Previous\s*1$/);
    await expect(nextTile).toHaveText(/Next\s*2$/);
    await expect(page.getByText("2 / 4")).toBeVisible();

    // Reopening reuses the captures
    await page.getByRole("button", { name: "Close speaker view" }).click();
    await page.getByRole("button", { name: "Speaker view" }).click();
    await expect(captured(nextTile)).toHaveCount(1);
    await expect(page.getByTestId("slide-capturer")).toHaveCount(0);
  });

  test("all slides can be shown and one picked", async ({
    page,
    e2eCommand,
  }) => {
    await e2eCommand.loginWithScenes({
      next: "/o/testorg",
      orgs: [
        {
          name: "TestOrg",
          slug: "testorg",
          projects: [
            {
              name: "TestProject",
              slug: "testproject",
              scenes: [customScene],
            },
          ],
        },
      ],
    });
    await page.goto("/app/testorg/testproject");
    await page.getByRole("button", { name: "Speaker view" }).click();
    await expect(page.getByText("1 / 3")).toBeVisible();

    const overview = page.getByRole("dialog", { name: "All slides" });
    await page.getByRole("button", { name: "All slides", exact: true }).click();
    await expect(overview.getByTestId("slide-container")).toHaveCount(3);
    await expect(overview.locator('[aria-current="true"]')).toHaveText(
      /Slide 1/,
    );

    // Escape leaves without changing slide
    await page.keyboard.press("Escape");
    await expect(overview).toBeHidden();
    await expect(page.getByText("1 / 3")).toBeVisible();

    // Picking a slide goes to it and returns to the speaker view
    await page.getByRole("button", { name: "All slides", exact: true }).click();
    await overview.getByTestId("slide-container").nth(2).click();
    await expect(overview).toBeHidden();
    await expect(page.getByText("3 / 3")).toBeVisible();
    await expect(page.getByText("Custom notes three")).toBeVisible();
  });

  test("marks drawn in the speaker view show on the output", async ({
    page,
    e2eCommand,
  }) => {
    await e2eCommand.loginWithScenes({
      next: "/o/testorg",
      orgs: [
        {
          name: "TestOrg",
          slug: "testorg",
          projects: [
            {
              name: "TestProject",
              slug: "testproject",
              scenes: [customScene],
            },
          ],
        },
      ],
    });
    const output = await page.context().newPage();
    try {
      await output.goto("/render/testorg/testproject");
      await page.goto("/app/testorg/testproject");
      await page.getByRole("button", { name: "Speaker view" }).click();
      await expect(page.getByText("1 / 3")).toBeVisible();

      const mainBox = page.getByTestId("speaker-main-box");
      const marks = (target: typeof page, tool: string) =>
        target
          .getByTestId("slides-ink-layer")
          .locator(`g[data-ink-tool="${tool}"] path`);
      // Where a mark sits, as fractions of the slide it's drawn on
      const placeOf = (target: typeof page, tool: string) =>
        marks(target, tool)
          .first()
          .evaluate((path: SVGPathElement) => {
            const mark = path.getBoundingClientRect();
            const slide = path.ownerSVGElement!.getBoundingClientRect();
            const at = (v: number) => Math.round(v * 100) / 100;
            return {
              left: at((mark.left - slide.left) / slide.width),
              right: at((mark.right - slide.left) / slide.width),
              middle: at(
                (mark.top + mark.height / 2 - slide.top) / slide.height,
              ),
            };
          });
      const drag = async (from: [number, number], to: [number, number]) => {
        const box = (await mainBox.boundingBox())!;
        const x = (f: number) => box.x + box.width * f;
        const y = (f: number) => box.y + box.height * f;
        await page.mouse.move(x(from[0]), y(from[1]));
        await page.mouse.down();
        await page.mouse.move(x(to[0]), y(to[1]), { steps: 15 });
        await page.mouse.up();
      };

      // Pencil: a line across the middle, shown on the output in the same
      // place on the slide
      // Even with the page selected, a press draws instead of dragging the
      // selection
      await page.keyboard.press("ControlOrMeta+a");
      await page.getByRole("button", { name: "Pencil", exact: true }).click();
      await drag([0.25, 0.5], [0.75, 0.5]);
      await expect(marks(output, "pencil")).toHaveCount(1);
      await expect(marks(page, "pencil")).toHaveCount(1);
      const onOutput = await placeOf(output, "pencil");
      expect(onOutput.left).toBeCloseTo(0.25, 1);
      expect(onOutput.right).toBeCloseTo(0.75, 1);
      expect(onOutput.middle).toBeCloseTo(0.5, 1);
      expect(await placeOf(page, "pencil")).toEqual(onOutput);

      await page
        .getByRole("button", { name: "Highlight", exact: true })
        .click();
      await drag([0.2, 0.3], [0.6, 0.3]);
      await expect(marks(output, "highlight")).toHaveCount(1);

      // Laser: shows while pressed, fades away after release
      await page.getByRole("button", { name: "Laser", exact: true }).click();
      const box = (await mainBox.boundingBox())!;
      await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, {
        steps: 10,
      });
      await expect(marks(output, "laser").first()).toBeAttached();
      await page.mouse.up();
      await expect(marks(output, "laser")).toHaveCount(0);
      // Pick it again to put it down
      await page.getByRole("button", { name: "Laser", exact: true }).click();
      await expect(page.getByTestId("speaker-ink-surface")).toHaveCount(0);

      // Marks stay on their slide
      await page.keyboard.press("ArrowRight");
      await expect(page.getByText("2 / 3")).toBeVisible();
      await expect(marks(output, "pencil")).toHaveCount(0);
      await page.keyboard.press("ArrowLeft");
      await expect(page.getByText("1 / 3")).toBeVisible();
      await expect(marks(output, "pencil")).toHaveCount(1);

      // An output that reloads still has them
      await output.reload();
      await expect(marks(output, "pencil")).toHaveCount(1);
      await expect(marks(output, "highlight")).toHaveCount(1);

      await page
        .getByRole("button", { name: "Clear marks on this slide" })
        .click();
      await expect(marks(output, "pencil")).toHaveCount(0);
      await expect(marks(output, "highlight")).toHaveCount(0);
    } finally {
      await output.close();
    }
  });

  test("speaker notes can be edited and are kept", async ({
    page,
    e2eCommand,
  }) => {
    const noNotesScene = buildCustomScene({
      importId: "import_e2enotes",
      docs: [deckDoc("Slide 1", "#1d4ed8"), deckDoc("Slide 2", "#047857")],
      notes: [],
    });
    await e2eCommand.loginWithScenes({
      next: "/o/testorg",
      orgs: [
        {
          name: "TestOrg",
          slug: "testorg",
          projects: [
            {
              name: "TestProject",
              slug: "testproject",
              scenes: [noNotesScene],
            },
          ],
        },
      ],
    });
    await page.goto("/app/testorg/testproject");
    await page.getByRole("button", { name: "Speaker view" }).click();

    // A deck imported without notes can still be given some
    await expect(page.getByText("No notes for this slide")).toBeVisible();
    await page.getByRole("button", { name: "Edit notes" }).click();
    const editor = page.getByRole("textbox", { name: "Speaker notes" });
    await expect(editor).toBeFocused();
    await editor.fill("Welcome everyone\nThen the reading");

    // Arrow keys type in the editor instead of changing slide
    await editor.press("ArrowLeft");
    await expect(page.getByText("1 / 2")).toBeVisible();

    await page.getByRole("button", { name: "Done editing notes" }).click();
    await expect(editor).toBeHidden();
    await expect(page.getByText("Welcome everyone")).toBeVisible();

    // Moving to another slide shows its own (empty) notes
    await page.getByTestId("speaker-next-box").locator("..").click();
    await expect(page.getByText("2 / 2")).toBeVisible();
    await expect(page.getByText("No notes for this slide")).toBeVisible();

    // Saved to the scene: still there after a reload
    await page.reload();
    await page.getByRole("button", { name: "Speaker view" }).click();
    await page.getByTestId("speaker-previous-box").locator("..").click();
    await expect(page.getByText("1 / 2")).toBeVisible();
    await expect(page.getByText("Welcome everyone")).toBeVisible();
    await expect(page.getByText("Then the reading")).toBeVisible();

    // An edit left open is saved when the slide changes
    await page.getByRole("button", { name: "Edit notes" }).click();
    await editor.fill("Edited then moved on");
    await page.getByTestId("speaker-next-box").locator("..").click();
    await expect(page.getByText("2 / 2")).toBeVisible();
    await page.getByTestId("speaker-previous-box").locator("..").click();
    await expect(page.getByText("Edited then moved on")).toBeVisible();
  });

  test("all slides' notes can be shown and edited in one go", async ({
    page,
    e2eCommand,
  }) => {
    await e2eCommand.loginWithScenes({
      next: "/o/testorg",
      orgs: [
        {
          name: "TestOrg",
          slug: "testorg",
          projects: [
            {
              name: "TestProject",
              slug: "testproject",
              scenes: [customScene],
            },
          ],
        },
      ],
    });
    await page.goto("/app/testorg/testproject");
    await page.getByRole("button", { name: "Speaker view" }).click();
    await expect(page.getByText("Custom notes one")).toBeVisible();
    await expect(page.getByText("Custom notes two")).toBeHidden();

    // Every slide's notes, with the current one marked
    await page
      .getByRole("button", { name: "Show notes for all slides" })
      .click();
    for (const note of NOTES) {
      await expect(page.getByText(note)).toBeVisible();
    }
    await expect(page.locator('li[aria-current="true"]')).toContainText(
      "Custom notes one",
    );

    // Edit them all as one text, split by --- lines
    await page.getByRole("button", { name: "Edit notes" }).click();
    const editor = page.getByRole("textbox", { name: "Speaker notes" });
    await expect(editor).toHaveValue(
      "--- Slide 1\nCustom notes one\n\n--- Slide 2\nCustom notes two\n\n--- Slide 3\nCustom notes three",
    );

    // A missing separator is refused rather than shifting notes around
    await editor.fill("--- Slide 1\nOne\n\nTwo\n--- Slide 3\nThree");
    await page.getByRole("button", { name: "Done editing notes" }).click();
    await expect(page.getByRole("alert")).toContainText(
      "expected one per slide",
    );
    await expect(editor).toBeVisible();

    // Clicking away does not save a half-edited text
    await page.getByText("Speaker notes", { exact: true }).click();
    await expect(editor).toBeVisible();

    await editor.fill(
      "--- Slide 1\nOpen in prayer\n\n--- Slide 2\n\n--- Slide 3\nClose\nwith the blessing",
    );
    await page.getByRole("button", { name: "Done editing notes" }).click();
    await expect(editor).toBeHidden();
    await expect(page.getByText("Open in prayer")).toBeVisible();
    await expect(page.getByText("No notes")).toBeVisible();

    // Each slide got its own part, kept after a reload
    await page.reload();
    await page.getByRole("button", { name: "Speaker view" }).click();
    await expect(page.getByText("Open in prayer")).toBeVisible();
    await page.getByTestId("speaker-next-box").locator("..").click();
    await expect(page.getByText("2 / 3")).toBeVisible();
    await expect(page.getByText("No notes for this slide")).toBeVisible();
    await page.getByTestId("speaker-next-box").locator("..").click();
    await expect(page.getByText("3 / 3")).toBeVisible();
    await expect(page.getByText("Close\nwith the blessing")).toBeVisible();
  });
});
