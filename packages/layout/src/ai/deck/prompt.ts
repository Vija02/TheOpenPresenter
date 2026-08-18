import type { DocAgentStep, SpawnTool } from "@repo/base-plugin/server";
import type { ChatMessage, ChatTool } from "@repo/base-types";
import * as z4 from "zod";

import { cloneDoc } from "../../doc/edit";
import { LayoutDoc, layoutDocValidator } from "../../schema/document";
import { buildAgentMessages, LayoutAiTurn } from "../messages";
import {
  explainZodError,
  isStrictParameters,
  toParameters,
} from "../schemaUtils";
import {
  applyLayoutTool,
  isReadOnlyLayoutTool,
  LAYOUT_TOOLS,
  unknownToolMessage,
} from "../tools";
import {
  blankSlideDoc,
  contentSlideDoc,
  sectionSlideDoc,
  titleSlideDoc,
} from "./deckBaseLayout";

/**
 * Deck-level AI: build and manage many slides from one request. A deck is
 * `{ slides: LayoutDoc[] }` and reuses the single-slide tools (`tools.ts`) for
 * within-slide edits via `edit_slide`.
 */

export type DeckDoc = {
  slides: LayoutDoc[];
};

export type DeckToolResult = {
  doc: DeckDoc;
  summary: string;
};

/* -------------------------------------------------------------------------- */
/* Argument schemas                                                           */
/* -------------------------------------------------------------------------- */

const opt = <T extends z4.ZodType>(schema: T, description: string) =>
  schema.nullish().describe(description);

const SLIDE_INDEX = z4
  .number()
  .int()
  .min(0)
  .describe("Zero-based slide index, exactly as listed by list_slides.");

/** One slide index, or several to act on in a single call. */
const SLIDE_INDICES = z4
  .array(SLIDE_INDEX)
  .min(1)
  .describe(
    "Zero-based slide indices, exactly as listed by list_slides. Pass several to act on multiple slides at once; order and duplicates do not matter.",
  );

/** De-duplicates and validates a batch of indices against the deck. */
const resolveIndices = (doc: DeckDoc, indices: number[]): number[] => {
  const unique = [...new Set(indices)];
  for (const index of unique) requireSlide(doc, index);
  return unique;
};

const SLIDE_LAYOUTS = ["title", "section", "content", "blank"] as const;

const slideContentSchema = z4.object({
  layout: z4
    .enum(SLIDE_LAYOUTS)
    .describe(
      "'title' for a title + optional subtitle (a deck opener); 'section' for a large divider heading; 'content' for a heading with a body of text or bullet lines; 'blank' for an empty slide you will fill with edit_slide.",
    ),
  title: opt(
    z4.string(),
    "The heading text. For 'content', this is the slide's title line.",
  ),
  subtitle: opt(
    z4.string(),
    "Secondary line under a 'title' layout (e.g. speaker, date).",
  ),
  body: opt(
    z4.string(),
    "Body text for a 'content' layout. Use '\\n' between lines; each line is shown as its own bullet-free line.",
  ),
  background: opt(
    z4.string(),
    "CSS background colour for the slide. Defaults to white.",
  ),
  color: opt(
    z4.string(),
    "CSS text colour. Defaults to a dark ink that reads on white.",
  ),
});

type SlideContentArg = z4.infer<typeof slideContentSchema>;

/* -------------------------------------------------------------------------- */
/* Slide builders                                                             */
/* -------------------------------------------------------------------------- */

const buildSlide = (content: SlideContentArg): LayoutDoc => {
  const common = {
    background: content.background ?? undefined,
    color: content.color ?? undefined,
  };

  switch (content.layout) {
    case "title":
      return titleSlideDoc({
        title: content.title ?? "Title",
        subtitle: content.subtitle ?? null,
        ...common,
      });
    case "section":
      return sectionSlideDoc({ title: content.title ?? "Section", ...common });
    case "content":
      return contentSlideDoc({
        title: content.title ?? "",
        body: content.body ?? "",
        ...common,
      });
    case "blank":
      return blankSlideDoc(common);
  }
};

/* -------------------------------------------------------------------------- */
/* Tool definitions                                                           */
/* -------------------------------------------------------------------------- */

type DeckTool<S extends z4.ZodType = z4.ZodType> = {
  name: string;
  description: string;
  schema: S;
  readOnly?: boolean;
  run: (doc: DeckDoc, args: z4.infer<S>) => DeckToolResult;
};

const deckTool = <S extends z4.ZodType>(def: DeckTool<S>): DeckTool =>
  def as unknown as DeckTool;

const requireSlide = (doc: DeckDoc, index: number): LayoutDoc => {
  const slide = doc.slides[index];
  if (!slide) {
    throw new Error(
      `No slide at index ${index}. There ${doc.slides.length === 1 ? "is" : "are"} ${doc.slides.length} slide(s); call list_slides.`,
    );
  }
  return slide;
};

const replaceSlideAt = (
  doc: DeckDoc,
  index: number,
  next: LayoutDoc,
): DeckDoc => ({
  slides: doc.slides.map((s, i) => (i === index ? next : s)),
});

/** Caps list_slides text so a large deck stays cheap to list; use get_slide for full text. */
const clip = (text: string, max = 120): string =>
  text.length > max ? `${text.slice(0, max)}…` : text;

const summariseSlide = (slide: LayoutDoc): Record<string, unknown> => {
  const texts = slide.elements
    .filter((e): e is Extract<typeof e, { type: "text" }> => e.type === "text")
    .map((e) => e.content)
    .filter((t) => t.trim() !== "")
    .map((t) => clip(t));
  return {
    elements: slide.elements.length,
    text: texts,
  };
};

const DECK_TOOL_LIST = [
  deckTool({
    name: "list_slides",
    description:
      "List every slide in order with its index and the text it contains. Call this first: indices shift as slides are added or removed.",
    schema: z4.strictObject({}),
    readOnly: true,
    run: (doc) => ({
      doc,
      summary: JSON.stringify({
        count: doc.slides.length,
        slides: doc.slides.map((s, i) => ({ index: i, ...summariseSlide(s) })),
      }),
    }),
  }),

  deckTool({
    name: "get_slide",
    description:
      "The full JSON of one slide, plus the rules for editing it. Only needed before set_slide_document — list_slides and edit_slide cover everything else.",
    schema: z4.strictObject({ index: SLIDE_INDEX }),
    readOnly: true,
    run: (doc, { index }) => ({
      doc,
      summary: JSON.stringify(requireSlide(doc, index)),
    }),
  }),

  deckTool({
    name: "add_slide",
    description:
      "Create a new slide from structured content and its layout. This is the primary way to build a deck from a script: one call per slide. The slide is composed and styled for you — prefer this over placing individual elements.",
    schema: z4.strictObject({
      content: slideContentSchema,
      at: opt(
        SLIDE_INDEX,
        "Insert BEFORE this index. Omit to append to the end.",
      ),
    }),
    run: (doc, { content, at }) => {
      const slide = buildSlide(content);
      const slides = [...doc.slides];
      const index = at ?? slides.length;
      slides.splice(Math.min(Math.max(0, index), slides.length), 0, slide);
      return {
        doc: { slides },
        summary: `Added a ${content.layout} slide${content.title ? ` titled "${content.title}"` : ""} at position ${Math.min(index, slides.length - 1) + 1}.`,
      };
    },
  }),

  deckTool({
    name: "edit_slide",
    description:
      "Fine-tune ONE slide with a single-slide editing tool. Use this to adjust an element the composed layouts got slightly wrong, or to add a shape/background to a specific slide. `tool` is a single-slide tool name (e.g. set_text_style, set_fill, add_text_element, set_rect, remove_element, list_elements) and `args` are its arguments.",
    schema: z4.strictObject({
      index: SLIDE_INDEX,
      tool: z4
        .string()
        .describe(
          "A single-slide tool name. Call edit_slide with tool 'list_elements' first to see that slide's element ids.",
        ),
      args: z4
        .record(z4.string(), z4.any())
        .nullish()
        .describe("Arguments for the single-slide tool."),
    }),
    run: (doc, { index, tool, args }) => {
      const slide = requireSlide(doc, index);
      const applied = applyLayoutTool(slide, tool, args ?? {});
      return {
        doc: replaceSlideAt(doc, index, applied.doc),
        summary: `Slide ${index + 1}: ${applied.summary}`,
      };
    },
  }),

  deckTool({
    name: "set_slide_document",
    description:
      "Replace ONE slide's whole document with the JSON given. Call get_slide first. Prefer add_slide and edit_slide; reach for this only for a bespoke slide the composed layouts cannot express.",
    schema: z4.strictObject({
      index: SLIDE_INDEX,
      document: z4
        .record(z4.string(), z4.any())
        .describe("The complete slide document, as get_slide returned it."),
    }),
    run: (doc, { index, document }) => {
      requireSlide(doc, index);
      const result = layoutDocValidator.safeParse(document);
      if (!result.success) {
        const issues = result.error.issues
          .slice(0, 10)
          .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
          .join("; ");
        throw new Error(`That slide failed validation — ${issues}`);
      }
      return {
        doc: replaceSlideAt(doc, index, result.data),
        summary: `Replaced slide ${index + 1}.`,
      };
    },
  }),

  deckTool({
    name: "duplicate_slide",
    description:
      "Copy one or more slides, inserting each copy right after its original. Pass `indices` to duplicate several at once, all taken against the CURRENT numbering.",
    schema: z4.strictObject({ indices: SLIDE_INDICES }),
    run: (doc, { indices }) => {
      const duplicate = new Set(resolveIndices(doc, indices));
      const slides: LayoutDoc[] = [];
      for (let i = 0; i < doc.slides.length; i++) {
        const slide = doc.slides[i]!;
        slides.push(slide);
        if (duplicate.has(i)) slides.push(cloneDoc(slide));
      }
      const humans = [...duplicate].sort((a, b) => a - b).map((i) => i + 1);
      return {
        doc: { slides },
        summary:
          humans.length === 1
            ? `Duplicated slide ${humans[0]}.`
            : `Duplicated slides ${humans.join(", ")}.`,
      };
    },
  }),

  deckTool({
    name: "move_slide",
    description: "Reorder a slide by moving it to a new index.",
    schema: z4.strictObject({
      index: SLIDE_INDEX,
      to: SLIDE_INDEX.describe("Destination index."),
    }),
    run: (doc, { index, to }) => {
      requireSlide(doc, index);
      const slides = [...doc.slides];
      const [moved] = slides.splice(index, 1);
      const dest = Math.min(Math.max(0, to), slides.length);
      slides.splice(dest, 0, moved!);
      return {
        doc: { slides },
        summary: `Moved slide ${index + 1} to position ${dest + 1}.`,
      };
    },
  }),

  deckTool({
    name: "remove_slide",
    description:
      "Delete one or more slides. Pass `indices` to remove several at once — they are all taken against the CURRENT numbering, so you do not need to account for shifting. Indices of surviving later slides shift down afterwards.",
    schema: z4.strictObject({ indices: SLIDE_INDICES }),
    run: (doc, { indices }) => {
      const remove = new Set(resolveIndices(doc, indices));
      if (remove.size >= doc.slides.length) {
        throw new Error(
          "Cannot remove every slide — a deck must keep at least one.",
        );
      }
      const humans = [...remove].sort((a, b) => a - b).map((i) => i + 1);
      return {
        doc: { slides: doc.slides.filter((_, i) => !remove.has(i)) },
        summary:
          humans.length === 1
            ? `Removed slide ${humans[0]}.`
            : `Removed slides ${humans.join(", ")}.`,
      };
    },
  }),
] as const;

const BY_NAME = new Map(DECK_TOOL_LIST.map((t) => [t.name, t]));

/* -------------------------------------------------------------------------- */
/* Provider-facing schema + execution                                         */
/* -------------------------------------------------------------------------- */

export const applyDeckTool = (
  doc: DeckDoc,
  name: string,
  rawArgs: unknown,
): DeckToolResult => {
  const definition = BY_NAME.get(name);
  if (!definition) {
    throw new Error(unknownToolMessage(name, [...BY_NAME.keys()]));
  }
  const parsed = definition.schema.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    throw new Error(`Invalid arguments: ${explainZodError(parsed.error)}`);
  }
  return definition.run(doc, parsed.data);
};

export const isReadOnlyDeckTool = (name: string): boolean =>
  BY_NAME.get(name)?.readOnly === true;

/* -------------------------------------------------------------------------- */
/* Prompt                                                                     */
/* -------------------------------------------------------------------------- */

const DECK_SYSTEM_PROMPT = `You build and edit slide DECKS for a church presentation app, using tools. A deck is an ordered list of slides; each slide is its own layout document.

WORKFLOW
- Call list_slides FIRST, every time. Slide indices are not guessable and shift as slides are added or removed.
- Then make the changes the request asks for. remove_slide, duplicate_slide and style_slide take an 'indices' array, so act on several slides in ONE call rather than one call each — the indices are all read against the current numbering, so you never have to account for shifting.
- When finished, reply with one short sentence summarising what you built or changed. Do not reply with JSON.
- If the request is not about slides, just say so without calling a tool.

WORK INCREMENTALLY — IMPORTANT
- Do NOT try to plan the entire deck in one long silent think and then emit everything at once. On a big script that stalls and the request fails.
- Instead, act in small batches: emit a few add_slide calls, let them apply, then continue with the next few. Keep each step short.
- Never spend a whole turn only reasoning. Reason briefly, then call tools. Progress should be visible as you go.

TWO PASSES: BUILD, THEN STYLE
- First pass: get the CONTENT right. Segment the script and add_slide every slide with its text. Do not fuss over looks yet.
- Second pass (optional): for slides that would benefit from polish, call style_slide with a one-line brief. It hands that ONE slide to a dedicated styling agent that sees only that slide — so put the theme, colours and the slide's role in the brief.
- You do NOT have to style every slide. Style the ones that need it. For pure visual tweaks prefer style_slide over driving edit_slide yourself.

BUILDING A DECK FROM A SCRIPT
This is the most important case. When the user pastes a script, sermon notes, an outline or talking points and asks for slides:
- Most of a script is meant to be SPOKEN, not shown. Do NOT make a slide for every sentence. Put on screen only what the congregation needs to SEE, and leave the rest for the speaker to say.
- What belongs on slides:
  - Bible verses — put the verse text on its own slide.
  - Summary points — the key takeaways, headings and memorable lines worth showing; a few short words each, not the full spoken explanation.
- What does NOT belong on slides: the speaker's narration, transitions, stories, asides and any prose that is just there to be read aloud. Skip it.
- Bible verses: include the verse numbers, and render them small as SUBSCRIPT before the words they mark (e.g. the number sits low and small, the verse text at normal size). Always show the reference (book chapter:verse) with the verse.
- Open with a 'title' slide when the script has an obvious title or topic. Use 'section' slides to divide major parts.
- Use 'content' slides for verses and summary points: a short heading plus a few short lines. Keep each slide to roughly 1 heading and up to ~5 short lines; split anything longer across multiple slides.
- Shorten to slide-sized phrases. Do NOT paste whole paragraphs verbatim — a slide is read from across a room, not studied.
- Build each slide with add_slide and its structured content. Only drop to edit_slide / set_slide_document for something the layouts cannot express (e.g. subscript verse numbers, if the composed layout does not produce them).

STYLE
- Slides default to a white background with dark text, like PowerPoint and Google Slides. Keep that unless the user asks for a theme.
- If the user asks for a colour scheme, pass background and color on each add_slide, and keep them consistent across the deck.
- Titles lead; body text is smaller. The composed layouts already handle hierarchy, so prefer them over hand-placing text.

GEOMETRY (only relevant when you use edit_slide / set_slide_document)
- rect is {x, y, w, h}: x/w are percent of slide WIDTH, y/h percent of HEIGHT, 0-100, x/y the top-left corner.
- fontSize and other style sizes are design units where 1 unit = 1% of slide width.

CURRENT SLIDE
- A "Context:" line may say which slide the user is looking at. When they say "this slide", "the current slide", "here" or "make it bigger" without naming a slide, they mean that one — use its index (still call list_slides first to confirm indices).
- With no such context and an ambiguous "this", ask which slide, or act on the whole deck if that is clearly the intent.

JUDGEMENT
- One agent, one conversation: you can build a whole deck AND fine-tune a single slide in the same thread. Pick the tool that fits — add_slide/move_slide/remove_slide/duplicate_slide for the deck, edit_slide for within a slide.
- Prefer building the whole deck the user asked for in one run rather than stopping to ask which slides they want — segment sensibly and go.
- Preserve any {{token}} placeholders in existing slides; they are substituted with real data at render time.`;

export type DeckAiTurn = LayoutAiTurn;

export const buildDeckAgentMessages = (
  request: string,
  history: DeckAiTurn[] = [],
  imageDataUrl?: string | null,
  context?: string | null,
): ChatMessage[] =>
  buildAgentMessages({
    systemPrompt: DECK_SYSTEM_PROMPT,
    request,
    history,
    imageDataUrl,
    leadIn: [context?.trim() ? `Context: ${context.trim()}` : null],
  });

/* -------------------------------------------------------------------------- */
/* style_slide: an agentic tool that spawns the single-slide `layout` agent    */
/* -------------------------------------------------------------------------- */

export const STYLE_SLIDE_TOOL = "style_slide";
const LAYOUT_CAPABILITY_ID = "layout";

const styleSlideSchema = z4.strictObject({
  indices: SLIDE_INDICES,
  brief: z4
    .string()
    .describe(
      "A one-line brief for the stylist: what to improve and the theme/colours to keep (e.g. 'Tighten spacing, keep the dark theme; this is a section divider'). The SAME brief is applied to every slide in `indices`, and each slide is styled on its own — so only batch slides that share a brief. The stylist sees ONLY one slide at a time, so include any context it needs.",
    ),
});

const styleSlideChatTool: ChatTool = {
  type: "function",
  function: {
    name: STYLE_SLIDE_TOOL,
    description:
      "Hand one or more slides to a dedicated styling agent to make them look good. Use this as a second pass after building slides. Pass `indices` (against the CURRENT numbering) to style several with the same brief; each slide is styled on its own and the stylist sees only that one slide. It will not change wording. Prefer this over driving edit_slide yourself for visual polish.",
    parameters: toParameters(styleSlideSchema),
    strict: true,
  },
};

// Runs the single-slide `layout` capability on each target slide in turn.
const styleSlideSpawn: SpawnTool<DeckDoc> = async function* (doc, args, ctx) {
  const parsed = styleSlideSchema.safeParse(args ?? {});
  if (!parsed.success) {
    throw new Error(`Invalid arguments: ${explainZodError(parsed.error)}`);
  }
  const { brief } = parsed.data;
  const indices = resolveIndices(doc, parsed.data.indices).sort(
    (a, b) => a - b,
  );

  let next = doc;
  for (const index of indices) {
    const slide = requireSlide(next, index);
    const human = index + 1;
    const label = (name: string) => `${STYLE_SLIDE_TOOL}[${human}] › ${name}`;

    const request = `Restyle this slide to look good. ${brief} Do not change the wording of any text.`;
    const child = ctx.invokeCapability(LAYOUT_CAPABILITY_ID, {
      doc: cloneDoc(slide),
      request,
      history: [],
    });

    let styled: LayoutDoc = slide;
    for await (const raw of child) {
      const step = raw as DocAgentStep<LayoutDoc>;
      switch (step.type) {
        case "done":
          styled = step.doc;
          break;
        case "tool":
          yield { type: "tool", name: label(step.name), summary: step.summary };
          break;
        case "toolPending":
          yield { type: "toolPending", name: label(step.name) };
          break;
        case "toolError":
          yield {
            type: "toolError",
            name: label(step.name),
            message: step.message,
          };
          break;
        default:
          yield step;
      }
    }

    next = replaceSlideAt(next, index, styled);
  }

  const humans = indices.map((i) => i + 1);
  return {
    doc: next,
    summary:
      humans.length === 1
        ? `Styled slide ${humans[0]}.`
        : `Styled slides ${humans.join(", ")}.`,
  };
};

/* -------------------------------------------------------------------------- */
/* Toolset                                                                    */
/* -------------------------------------------------------------------------- */

const deckTools: ChatTool[] = [
  ...DECK_TOOL_LIST.map((t) => {
    const parameters = toParameters(t.schema);
    return {
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters,
        ...(isStrictParameters(parameters) ? { strict: true } : {}),
      },
    };
  }),
  styleSlideChatTool,
];

export const deckAgentToolset = {
  tools: deckTools,
  buildMessages: buildDeckAgentMessages,
  apply: (doc: DeckDoc, name: string, args: unknown) =>
    applyDeckTool(doc, name, args),
  isReadOnly: isReadOnlyDeckTool,
  readOnlySummary: "Read the slide deck.",
  isSpawnTool: (name: string) => name === STYLE_SLIDE_TOOL,
  spawn: (name: string): SpawnTool<DeckDoc> | undefined =>
    name === STYLE_SLIDE_TOOL ? styleSlideSpawn : undefined,
};

export const createDeckAgentToolset = (context?: string | null) => ({
  ...deckAgentToolset,
  buildMessages: (
    request: string,
    history: DeckAiTurn[] = [],
    imageDataUrl?: string | null,
  ) => buildDeckAgentMessages(request, history, imageDataUrl, context),
});

export { LAYOUT_TOOLS };
