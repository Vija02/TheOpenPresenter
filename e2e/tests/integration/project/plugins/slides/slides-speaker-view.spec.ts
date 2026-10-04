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

    // The Next tile selects the whole next slide, like the slide list does,
    // and the notes move with it.
    const nextTile = page.getByTestId("speaker-next-box").locator("..");
    await expect(nextTile).toHaveText(/Next\s*2$/);
    await nextTile.click();
    await expect(page.getByText("Notes for slide two")).toBeVisible();
  });
});
