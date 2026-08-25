import * as z4 from "zod";

import {
  duplicateElement,
  elementLabel,
  findElement,
  insertElement,
  patchElement,
  patchRect,
  patchTextElement,
  patchTextStyle,
  removeElement,
  reorderElement,
  setElementFill,
} from "../doc/edit";
import { createShapeElement, createTextElement } from "../schema/defaults";
import { LayoutDoc, layoutDocValidator } from "../schema/document";
import { shapeKinds } from "../schema/element";
import { Paint, linearGradientPaint, solidPaint } from "../schema/paint";
import {
  horizontalAlignments,
  textFitModes,
  verticalAlignments,
} from "../schema/style";
import { LAYOUT_DOC_RULES, droppedBindingTokens } from "./prompt";
import {
  explainZodError,
  isStrictParameters,
  toParameters,
} from "./schemaUtils";

/**
 * The tool surface for AI layout editing.
 * A thin skin over `doc/edit.ts`
 * Targeted tools but `replace_document` exists
 */

const opt = <T extends z4.ZodType>(schema: T, description: string) =>
  schema.nullish().describe(description);

/** Percent of the slide's width or height. Bounded loosely: off-slide is legal. */
const pct = () => z4.number().min(-1000).max(1000);

/** Design units: 1 unit = 1% of slide width. */
const units = () => z4.number();

const ID = z4
  .string()
  .min(1)
  .describe("Element id, exactly as listed by list_elements.");

const gradientSchema = z4.object({
  angle: units().describe(
    "CSS degrees: 0 points to the top and increases clockwise, so 180 is top-to-bottom, 90 is left-to-right, 135 is towards the bottom-right corner.",
  ),
  stops: z4
    .array(
      z4.object({
        offset: z4.number().min(0).max(1).describe("0-1 along the gradient."),
        color: z4.string().describe("CSS colour."),
      }),
    )
    .min(2)
    .describe("Two or more stops."),
});

type GradientArg = z4.infer<typeof gradientSchema>;

const GRADIENT_DESCRIPTION =
  "Linear gradient. Takes precedence over color when both are given.";

const geometry = {
  x: pct().describe("Left edge, 0-100."),
  y: pct().describe("Top edge, 0-100."),
  w: pct().describe("Width, 0-100."),
  h: pct().describe("Height, 0-100."),
};

const fillArgs = {
  color: opt(z4.string(), "CSS fill colour."),
  gradient: opt(gradientSchema, GRADIENT_DESCRIPTION),
  opacity: opt(z4.number().min(0).max(1), "0-1. Defaults to 1."),
};

/* -------------------------------------------------------------------------- */
/* Helpers used by the handlers                                               */
/* -------------------------------------------------------------------------- */

/** Gradient wins when both are given, matching what the tool description says. */
const paintFrom = (
  color: string | null | undefined,
  gradient: GradientArg | null | undefined,
  opacity = 1,
): Paint | null => {
  if (gradient) {
    return linearGradientPaint(gradient.angle, gradient.stops, opacity);
  }
  return color ? solidPaint(color, opacity) : null;
};

const freshId = (doc: LayoutDoc, base: string): string => {
  let n = 1;
  let candidate = `${base}-${n}`;
  while (doc.elements.some((e) => e.id === candidate)) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
};

type Present<T> = { [K in keyof T]?: Exclude<T[K], null | undefined> };

/**
 * Strips undefined *and* null, so a patch never writes either into a Yjs-backed doc
 */
const defined = <T extends object>(patch: T): Present<T> =>
  Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined && v !== null),
  ) as Present<T>;

const requireElement = (doc: LayoutDoc, id: string) => {
  const element = findElement(doc, id);
  if (!element) {
    throw new Error(
      `No element with id "${id}". Call list_elements to see what exists.`,
    );
  }
  return element;
};

export type LayoutToolResult = {
  doc: LayoutDoc;
  summary: string;
};

/* -------------------------------------------------------------------------- */
/* Tool definitions                                                          */
/* -------------------------------------------------------------------------- */

type LayoutTool<S extends z4.ZodType = z4.ZodType> = {
  name: string;
  description: string;
  schema: S;
  readOnly?: boolean;
  run: (doc: LayoutDoc, args: z4.infer<S>) => LayoutToolResult;
};

/** Keeps `args` inferred per-tool instead of widening to the union. */
const tool = <S extends z4.ZodType>(definition: LayoutTool<S>): LayoutTool =>
  definition as unknown as LayoutTool;

const TOOL_LIST = [
  tool({
    name: "list_elements",
    description:
      "List every element with its id, type, name, rect and key style. Call this first: ids are not guessable.",
    schema: z4.strictObject({}),
    readOnly: true,
    run: (doc) => ({
      doc,
      summary: JSON.stringify(
        doc.elements.map((e, i) => ({
          id: e.id,
          type: e.type,
          label: elementLabel(e),
          order: i,
          rect: e.rect,
          ...(e.hidden ? { hidden: true } : {}),
          ...(e.locked ? { locked: true } : {}),
          ...(e.type === "text"
            ? { content: e.content, fit: e.fit, style: e.style }
            : {}),
          ...(e.type === "shape" ? { kind: e.kind, fill: e.fill } : {}),
        })),
      ),
    }),
  }),

  tool({
    name: "get_document",
    description:
      "The complete document as JSON, plus the rules for writing one back. Only needed before replace_document — list_elements is smaller and enough for everything else.",
    schema: z4.strictObject({}),
    readOnly: true,
    run: (doc) => ({
      doc,
      summary: `${LAYOUT_DOC_RULES}\n\nCurrent document:\n${JSON.stringify(doc, null, 2)}`,
    }),
  }),

  tool({
    name: "replace_document",
    description:
      "Replace the WHOLE document with the one given. Call get_document first, and only use this for a redesign the targeted tools would take a dozen calls to express: a wholesale rewrite risks every element id and every {{token}} at once, and the damage does not show up as an error.",
    schema: z4.strictObject({
      document: z4
        .record(z4.string(), z4.any())
        .describe(
          "The complete document, in exactly the shape get_document returned. Not a patch.",
        ),
    }),
    run: (doc, { document }) => {
      // The same validator the rest of the app uses: this document reaches the
      // canvas, so nothing less will do.
      const result = layoutDocValidator.safeParse(document);
      if (!result.success) {
        // Capped: a document wrong in fifty places will not be fixed by listing
        // fifty, and the list is prompt the next turn has to pay for.
        const issues = result.error.issues
          .slice(0, 10)
          .map(
            (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
          )
          .join("; ");
        throw new Error(`That document failed validation — ${issues}`);
      }

      const next = result.data;
      const dropped = droppedBindingTokens(doc, next);
      return {
        doc: next,
        // Warned about, not rejected
        summary: dropped.length
          ? `Replaced the document. WARNING: this dropped the {{${dropped.join("}}, {{")}}} placeholder${dropped.length > 1 ? "s" : ""}, so that content will no longer appear. Put it back unless the request asked for it to go.`
          : "Replaced the whole document.",
      };
    },
  }),

  tool({
    name: "set_rect",
    description:
      "Move or resize an element. x and w are percent of slide WIDTH; y and h are percent of slide HEIGHT. Omit any field to leave it unchanged.",
    schema: z4.strictObject({
      id: ID,
      x: opt(pct(), "Left edge, 0-100."),
      y: opt(pct(), "Top edge, 0-100."),
      w: opt(pct(), "Width, 0-100."),
      h: opt(pct(), "Height, 0-100."),
    }),
    run: (doc, { id, ...patch }) => {
      requireElement(doc, id);
      return {
        doc: patchRect(doc, id, defined(patch)),
        summary: `Moved/resized ${id}.`,
      };
    },
  }),

  tool({
    name: "set_text_style",
    description:
      "Change how text looks. Sizes are design units where 1 unit = 1% of slide width.",
    schema: z4.strictObject({
      id: ID,
      fontFamily: opt(
        z4.string(),
        "CSS font stack, e.g. 'Montserrat Variable, sans-serif'.",
      ),
      fontSize: opt(
        units(),
        "Design units. Only used directly when fit is 'declared'.",
      ),
      fontWeight: opt(z4.number().min(100).max(900), "100-900."),
      fontStyle: opt(z4.enum(["normal", "italic"]), "Normal or italic."),
      color: opt(z4.string(), "CSS colour, e.g. '#ffffff'."),
      align: opt(z4.enum(horizontalAlignments), "Horizontal alignment."),
      valign: opt(z4.enum(verticalAlignments), "Vertical alignment."),
      lineHeight: opt(z4.number(), "Multiplier, e.g. 1.2."),
      letterSpacing: opt(units(), "Design units."),
    }),
    run: (doc, { id, ...patch }) => {
      const element = requireElement(doc, id);
      if (element.type !== "text") {
        throw new Error(`Element "${id}" is not text, so it has no style.`);
      }
      return {
        doc: patchTextStyle(doc, id, defined(patch)),
        summary: `Restyled ${id}.`,
      };
    },
  }),

  tool({
    name: "set_text_fit",
    description:
      "How text is sized to its box. 'declared' uses fontSize verbatim; 'shrinkToFit' treats it as a maximum; 'fitNoWrap' fits each line; 'wrap' fits while wrapping.",
    schema: z4.strictObject({
      id: ID,
      fit: z4.enum(textFitModes).describe("How the text is sized to its box."),
    }),
    run: (doc, { id, fit }) => {
      const element = requireElement(doc, id);
      if (element.type !== "text") {
        throw new Error(`Element "${id}" is not text, so it has no fit mode.`);
      }
      return {
        doc: patchTextElement(doc, id, { fit }),
        summary: `Set ${id} to ${fit}.`,
      };
    },
  }),

  tool({
    name: "set_text_content",
    description:
      "Replace an element's text. Use ONLY when the request is explicitly about wording. Preserve any {{token}} placeholders: they are substituted with real data at render time.",
    schema: z4.strictObject({
      id: ID,
      content: z4.string().describe("New text, tokens included."),
    }),
    run: (doc, { id, content }) => {
      const element = requireElement(doc, id);
      if (element.type !== "text") {
        throw new Error(`Element "${id}" is not text, so it has no content.`);
      }
      return {
        doc: patchTextElement(doc, id, { content }),
        summary: `Changed the text of ${id}.`,
      };
    },
  }),

  tool({
    name: "set_fill",
    description:
      "Set an element's background to a colour or a linear gradient, or clear it. For text this fills the box, not the glyphs. Pass gradient OR color, not both.",
    schema: z4.strictObject({
      id: ID,
      color: opt(
        z4.string(),
        "CSS colour. Omit both color and gradient to clear the fill.",
      ),
      gradient: fillArgs.gradient,
      opacity: fillArgs.opacity,
    }),
    run: (doc, { id, color, gradient, opacity }) => {
      requireElement(doc, id);
      const fill = paintFrom(color, gradient, opacity ?? 1);
      return {
        doc: setElementFill(doc, id, fill),
        summary: fill
          ? `Filled ${id} with a ${fill.type === "solid" ? fill.color : "gradient"}.`
          : `Cleared the fill on ${id}.`,
      };
    },
  }),

  tool({
    name: "add_shape_element",
    description:
      "Add a rectangle, ellipse or line. This is how you add a background: a full-bleed rect (x0 y0 w100 h100) with order 'back'.",
    schema: z4.strictObject({
      kind: z4.enum(shapeKinds).describe("The shape to draw."),
      ...geometry,
      ...fillArgs,
      radius: opt(units(), "Corner radius, design units."),
      name: opt(z4.string(), "Layer name shown in the editor."),
      order: opt(
        z4.enum(["front", "back"]),
        "'back' puts it behind everything, which is what a background needs. Defaults to 'front'.",
      ),
    }),
    run: (doc, args) => {
      const id = freshId(doc, args.kind);
      const element = createShapeElement({
        id,
        kind: args.kind,
        name: args.name ?? null,
        rect: { x: args.x, y: args.y, w: args.w, h: args.h },
        fill: paintFrom(args.color, args.gradient, args.opacity ?? 1),
        ...(args.radius != null ? { radius: args.radius } : {}),
      });
      // Index 0 is the back of the paint order, where a background has to sit or
      // it covers everything already on the slide.
      const index = args.order === "back" ? 0 : undefined;
      return {
        doc: insertElement(doc, element, index),
        summary: `Added a ${args.kind} as ${id}.`,
      };
    },
  }),

  tool({
    name: "add_text_element",
    description:
      "Add a new text element. Only for text the layout does not already have — restyle or move what exists instead where possible.",
    schema: z4.strictObject({
      content: z4
        .string()
        .describe("The text. Include a {{token}} only if binding real data."),
      ...geometry,
      fit: opt(z4.enum(textFitModes), "How the text is sized to its box."),
      fontSize: opt(
        units(),
        "Design units. Used directly only when fit is 'declared'.",
      ),
      fontWeight: opt(z4.number().min(100).max(900), "100-900."),
      color: opt(z4.string(), "CSS colour."),
      align: opt(z4.enum(horizontalAlignments), "Horizontal alignment."),
      valign: opt(z4.enum(verticalAlignments), "Vertical alignment."),
      name: opt(z4.string(), "Layer name shown in the editor."),
    }),
    run: (doc, args) => {
      const id = freshId(doc, "text");
      const element = createTextElement({
        id,
        content: args.content,
        name: args.name ?? null,
        rect: { x: args.x, y: args.y, w: args.w, h: args.h },
        fit: args.fit ?? "shrinkToFit",
        style: defined({
          fontSize: args.fontSize,
          fontWeight: args.fontWeight,
          color: args.color,
          align: args.align,
          valign: args.valign,
        }),
      });
      return {
        doc: insertElement(doc, element),
        summary: `Added text as ${id}.`,
      };
    },
  }),

  tool({
    name: "set_element",
    description: "Element-level properties that are not geometry or text.",
    schema: z4.strictObject({
      id: ID,
      name: opt(z4.string(), "Layer name shown in the editor."),
      rotation: opt(z4.number(), "Degrees."),
      opacity: opt(z4.number().min(0).max(1), "0-1."),
      hidden: opt(z4.boolean(), "Never rendered when true."),
      locked: opt(z4.boolean(), "Not selectable in the editor."),
      radius: opt(units(), "Corner radius, design units."),
    }),
    run: (doc, { id, ...patch }) => {
      requireElement(doc, id);
      return {
        doc: patchElement(doc, id, defined(patch)),
        summary: `Updated ${id}.`,
      };
    },
  }),

  tool({
    name: "reorder_element",
    description:
      "Change paint order. 'front'/'back' jump to the end; 'forward'/'backward' move one step.",
    schema: z4.strictObject({
      id: ID,
      direction: z4
        .enum(["forward", "backward", "front", "back"])
        .describe("Which way to move it in the paint order."),
    }),
    run: (doc, { id, direction }) => {
      requireElement(doc, id);
      return {
        doc: reorderElement(doc, id, direction),
        summary: `Moved ${id} ${direction}.`,
      };
    },
  }),

  tool({
    name: "duplicate_element",
    description: "Copy an element, offset slightly. Returns the new id.",
    schema: z4.strictObject({ id: ID }),
    run: (doc, { id }) => {
      requireElement(doc, id);
      const result = duplicateElement(doc, id);
      return {
        doc: result.doc,
        summary: `Duplicated ${id} as ${result.id}.`,
      };
    },
  }),

  tool({
    name: "remove_element",
    description:
      "Delete an element. Check first whether it carries a {{token}}: removing it makes that content disappear from every slide.",
    schema: z4.strictObject({ id: ID }),
    run: (doc, { id }) => {
      requireElement(doc, id);
      return { doc: removeElement(doc, id), summary: `Removed ${id}.` };
    },
  }),
] as const;

const BY_NAME = new Map(TOOL_LIST.map((t) => [t.name, t]));

/* -------------------------------------------------------------------------- */
/* Provider-facing schema                                                     */
/* -------------------------------------------------------------------------- */

/** A JSON Schema fragment, as handed to the provider. */
export type LayoutToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict: boolean;
};

export const LAYOUT_TOOLS: LayoutToolDefinition[] = TOOL_LIST.map((t) => {
  const parameters = toParameters(t.schema);
  return {
    name: t.name,
    description: t.description,
    parameters,
    strict: isStrictParameters(parameters),
  };
});

export const isReadOnlyLayoutTool = (name: string): boolean =>
  BY_NAME.get(name)?.readOnly === true;

/* -------------------------------------------------------------------------- */
/* Execution                                                                  */
/* -------------------------------------------------------------------------- */

const editDistance = (a: string, b: string): number => {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i, ...Array<number>(b.length).fill(0)];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    prev = curr;
  }
  return prev[b.length]!;
};

export const unknownToolMessage = (
  name: string,
  available: string[],
): string => {
  const closest = available
    .map((candidate) => ({ candidate, d: editDistance(name, candidate) }))
    .sort((a, b) => a.d - b.d)[0];
  const hint =
    closest && closest.d <= Math.max(3, Math.ceil(name.length / 2))
      ? ` Did you mean "${closest.candidate}"?`
      : "";
  return `Unknown tool "${name}".${hint} Available: ${available.join(", ")}.`;
};

/**
 * Runs one tool call against a document
 */
export const applyLayoutTool = (
  doc: LayoutDoc,
  name: string,
  rawArgs: unknown,
): LayoutToolResult => {
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
