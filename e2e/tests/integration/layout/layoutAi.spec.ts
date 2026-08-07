import type { Locator, Page } from "@playwright/test";

import { expect, test } from "../../../fixtures/aiFixture";
import type { ProjectPage } from "../../../pages/ProjectPage";

/**
 * The AI layout-editing workflow, end to end.
 *
 * Everything here is real except the model: the request goes through the
 * capability route, the SSE transport, the agent loop and the layout tools, and
 * the assertions are on the canvas and the transcript. Only the provider is
 * faked (e2e/scripts/fakeAiServer.ts), because the model is the one link in
 * that chain with nothing deterministic to assert.
 *
 * Every test types `fakeAi.marker` into the prompt: the fake keys scripts by it,
 * which is what stops the parallel browser projects consuming each other's
 * scripted turns.
 */

const BODY = '[data-lay-id="bible-body"]';
const REFERENCE = '[data-lay-id="bible-reference"]';

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

/** The AI panel lives in the document inspector, shown when nothing is selected. */
const aiPanel = (dialog: Locator) => {
  const prompt = dialog.getByPlaceholder(/Move the reference|Follow up/);
  return {
    prompt,
    send: dialog.getByRole("button", { name: "Send", exact: true }),
    stop: dialog.getByRole("button", { name: "Stop", exact: true }),
    undo: dialog.getByRole("button", { name: "Undo", exact: true }),
    ask: async (text: string) => {
      await prompt.fill(text);
      await dialog.getByRole("button", { name: "Send", exact: true }).click();
    },
  };
};

const textStyle = (page: Page, elementSelector: string, property: string) =>
  page
    .locator(`${elementSelector} .lay--text-content`)
    .evaluate(
      (el, prop) => getComputedStyle(el).getPropertyValue(prop),
      property,
    );

test.describe.serial("Layout AI editing", () => {
  test.beforeEach(async ({ e2eCommand, requireFakeAi }) => {
    await requireFakeAi("layout");
    await Promise.all([
      e2eCommand.serverCommand("clearTestUsers"),
      e2eCommand.serverCommand("clearTestOrganizations"),
      e2eCommand.serverCommand("clearBibleData"),
    ]);
  });

  test("runs the tool loop, streams its progress and applies the edit", async ({
    page,
    projectPage,
    loginAndGoToProject,
    fakeAi,
  }) => {
    // Two working turns then a closing one. The loop ends on the turn that
    // requests no tools, which is what makes the third turn necessary.
    await fakeAi.script([
      {
        reasoning: "First I need the element ids, so list_elements.",
        toolCalls: [{ name: "list_elements", arguments: {} }],
      },
      {
        content: "Making the body text red.",
        toolCalls: [
          {
            name: "set_text_style",
            arguments: { id: "bible-body", color: "#ff0000" },
          },
        ],
      },
      { content: "Turned the body text red." },
    ]);

    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });
    const panel = aiPanel(dialog);

    await expect(dialog.getByText("Ask AI")).toBeVisible();
    await panel.ask(`Make the body red ${fakeAi.marker}`);

    // Reasoning is collapsed, so the toggle is the evidence it arrived.
    await expect(dialog.getByText(/Thought|Thinking/)).toBeVisible();

    // The read-only tool reports generically; the mutating one reports itself.
    await expect(dialog.getByText("Read the layout.")).toBeVisible();
    await expect(dialog.getByText("Restyled bible-body.")).toBeVisible();
    await expect(dialog.getByText("Turned the body text red.")).toBeVisible();

    // The point of the whole exercise: the document actually changed.
    await expect
      .poll(() => textStyle(page, BODY, "color"))
      .toBe("rgb(255, 0, 0)");

    // Expanding shows the reasoning text itself.
    await dialog.getByText(/Thought|Thinking/).click();
    await expect(dialog.getByText(/list_elements/)).toBeVisible();

    // What the server sent: the tools really were advertised, and the tool
    // result was fed back for the second turn.
    const sent = await fakeAi.requests();
    expect(sent.length).toBe(3);
    expect(sent[0]!.tools).toContain("list_elements");
    expect(sent[0]!.tools).toContain("set_text_style");
    expect(sent[0]!.hasImage).toBe(false);
    expect(sent[1]!.messages.length).toBeGreaterThan(sent[0]!.messages.length);
  });

  test("undo restores the document to before the run", async ({
    page,
    projectPage,
    loginAndGoToProject,
    fakeAi,
  }) => {
    await fakeAi.script([
      {
        toolCalls: [
          {
            name: "set_text_style",
            arguments: { id: "bible-reference", color: "#00ff00" },
          },
        ],
      },
      { content: "Recoloured the reference." },
    ]);

    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });
    const panel = aiPanel(dialog);

    const before = await textStyle(page, REFERENCE, "color");
    expect(before).not.toBe("rgb(0, 255, 0)");

    await panel.ask(`Recolour the reference ${fakeAi.marker}`);

    await expect
      .poll(() => textStyle(page, REFERENCE, "color"))
      .toBe("rgb(0, 255, 0)");

    // Offered only because something changed.
    await expect(panel.undo).toBeVisible();
    await panel.undo.click();

    await expect.poll(() => textStyle(page, REFERENCE, "color")).toBe(before);
    // One undo point per run, so the affordance goes away once used.
    await expect(panel.undo).toBeHidden();
  });

  test("a provider failure is reported without losing the session", async ({
    projectPage,
    loginAndGoToProject,
    fakeAi,
  }) => {
    // 400 rather than 500: the client retries retryable statuses, and this test
    // is about the message reaching the user, not about the retry policy.
    await fakeAi.script([{ errorStatus: 400 }]);

    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });
    const panel = aiPanel(dialog);

    await panel.ask(`Break it ${fakeAi.marker}`);

    await expect(dialog.getByText(/The AI request failed/)).toBeVisible();

    // Still usable: the failure ended the run, not the panel.
    await expect(panel.send).toBeVisible();
    await expect(panel.prompt).toBeEnabled();
  });

  test("stop cancels a run in flight", async ({
    page,
    projectPage,
    loginAndGoToProject,
    fakeAi,
  }) => {
    await fakeAi.script([
      {
        reasoning: "Thinking about it.",
        toolCalls: [{ name: "list_elements", arguments: {} }],
      },
      // Long enough that the click definitely lands mid-run.
      {
        delayMs: 10_000,
        toolCalls: [
          {
            name: "set_text_style",
            arguments: { id: "bible-body", color: "#0000ff" },
          },
        ],
      },
    ]);

    const dialog = await openStyleModal({ loginAndGoToProject, projectPage });
    const panel = aiPanel(dialog);

    const before = await textStyle(page, BODY, "color");

    await panel.ask(`Take your time ${fakeAi.marker}`);

    // Stop replaces Send only while a run is pending.
    await expect(panel.stop).toBeVisible();
    await expect(dialog.getByText("Read the layout.")).toBeVisible();

    await panel.stop.click();

    await expect(panel.send).toBeVisible();
    await expect(panel.stop).toBeHidden();

    // A stopped run is not a failed one.
    await expect(dialog.getByText(/The AI request failed/)).toBeHidden();

    // The turn that was still in flight never applied.
    expect(await textStyle(page, BODY, "color")).toBe(before);
  });
});
