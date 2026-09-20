import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { LayoutHostCatalogProvider } from "../../react/context/hostCatalog";
import { createLayoutDoc, createTextElement } from "../../schema/defaults";
import { LayoutDoc } from "../../schema/document";
import { docFeeds } from "../../doc/edit";
import { FeedsSection } from "../inspector/sections/FeedsSection";

const catalog = {
  sources: [
    {
      id: "scene:2:scene-1",
      label: "Slides",
      group: "Screen 2",
      source: { kind: "scene" as const, rendererId: "2", sceneId: "scene-1" },
    },
  ],
  derivationFields: () => [
    {
      key: "offset",
      type: "number" as const,
      label: "Step offset",
      default: 0,
      min: -20,
      max: 20,
      step: 1,
    },
  ],
  dataBindings: () => [
    { key: "notes", label: "Speaker notes", type: "text" as const },
  ],
};

/** Drives the section the way the inspector does, holding the doc in state. */
const Harness = ({ initial }: { initial: LayoutDoc }) => {
  const [doc, setDoc] = useState(initial);
  return (
    <LayoutHostCatalogProvider catalog={catalog}>
      <FeedsSection doc={doc} onChange={setDoc} />
      <pre data-testid="feeds">{JSON.stringify(docFeeds(doc))}</pre>
      <pre data-testid="text">
        {doc.elements[0]?.type === "text" ? doc.elements[0].content : ""}
      </pre>
    </LayoutHostCatalogProvider>
  );
};

const emptyDoc = () =>
  createLayoutDoc({
    elements: [createTextElement({ id: "t1", content: "{{live.notes}}" })],
  });

describe("FeedsSection", () => {
  it("adds a feed pointing at the first available source", async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyDoc()} />);

    await user.click(screen.getByText("+ Add feed"));

    const feeds = JSON.parse(screen.getByTestId("feeds").textContent!);
    expect(feeds).toHaveLength(1);
    expect(feeds[0].name).toBe("feed");
    expect(feeds[0].source.sceneId).toBe("scene-1");
  });

  it("lists the tokens the source publishes, under the feed name", async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyDoc()} />);

    await user.click(screen.getByText("+ Add feed"));

    expect(screen.getByText("{{feed.notes}}")).toBeDefined();
  });

  it("names a second feed uniquely rather than colliding", async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyDoc()} />);

    await user.click(screen.getByText("+ Add feed"));
    await user.click(screen.getByText("+ Add feed"));

    const feeds = JSON.parse(screen.getByTestId("feeds").textContent!);
    expect(feeds.map((f: { name: string }) => f.name)).toEqual([
      "feed",
      "feed2",
    ]);
  });

  it("removes a feed", async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyDoc()} />);

    await user.click(screen.getByText("+ Add feed"));
    await user.click(screen.getByTitle("Remove feed"));

    expect(screen.getByTestId("feeds").textContent).toBe("[]");
  });

  it("renaming rewrites the tokens that addressed the feed", async () => {
    const user = userEvent.setup();
    const doc = createLayoutDoc({
      feeds: [
        {
          name: "feed",
          source: { kind: "scene", rendererId: "2", sceneId: "scene-1" },
          derivation: null,
        },
      ],
      elements: [
        createTextElement({ id: "t1", content: "NEXT: {{feed.notes}}" }),
      ],
    });
    render(<Harness initial={doc} />);

    const field = screen.getByDisplayValue("feed");
    await user.clear(field);
    await user.type(field, "next");
    await user.tab();

    expect(screen.getByTestId("text").textContent).toBe("NEXT: {{next.notes}}");
  });

  it("keeps the stored name when a rename is rejected", async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyDoc()} />);
    await user.click(screen.getByText("+ Add feed"));

    const field = screen.getByDisplayValue("feed");
    await user.clear(field);
    await user.tab();

    // An empty name would orphan every token addressing the feed.
    const feeds = JSON.parse(screen.getByTestId("feeds").textContent!);
    expect(feeds[0].name).toBe("feed");
    expect(screen.getByDisplayValue("feed")).toBeDefined();
  });
});
