import type { AiTurn, ChatMessage } from "@repo/base-types";

import {
  LAYOUT_DOC_VERSION,
  LayoutDoc,
  layoutFitModes,
} from "../schema/document";
import { shapeKinds } from "../schema/element";
import { imageFitModes } from "../schema/paint";
import {
  horizontalAlignments,
  textFitModes,
  textTransforms,
  verticalAlignments,
} from "../schema/style";

export type LayoutAiTurn = AiTurn;

const list = (values: readonly string[]) =>
  values.map((v) => `"${v}"`).join(" | ");

/**
 * Prose rather than JSON Schema because `get_document` returns the real document
 */
export const LAYOUT_DOC_RULES = `SCHEMA RULES
- "version" must be exactly ${LAYOUT_DOC_VERSION}.
- Every field shown in the current document must be present in your output. An absent value is written as explicit null, never omitted: these documents are persisted through Yjs, which cannot store undefined.
- The exception is "spanRoles", which is a patch object. There, omit the keys you do not want rather than setting them to null.
- Do not invent fields that are not in the current document.
- Image "src" is either a plain string (a URL, an internal media reference, or a "{{token}}") or an object. Never convert one form into the other.
- "elements" is an array in paint order: index 0 is furthest back, the last entry is on top. Reorder it to change stacking.

GEOMETRY
- "rect" is {x, y, w, h} — NOT width/height. x/y are the top-left corner. x and w are percent of slide WIDTH; y and h are percent of slide HEIGHT. All 0-100.
- Sizes in "style" (fontSize, letterSpacing, padding) and "radius" are design units, where 1 unit = 1% of the slide WIDTH. On a 1920px slide, fontSize 6 is about 115px.
- style padding insets the text from its own box. It does not move or grow the element, and auto-sized text is fitted to the space that remains. Use it to keep text off a fill's edges rather than shrinking the rect.
  - With "paddingIsLinked" true (the default), the single "padding" value applies to all four sides.
  - With it false, "paddingTop"/"paddingRight"/"paddingBottom"/"paddingLeft" apply instead. Both sets are stored, so set the ones for the mode you want and leave the others alone.
- "stroke" is the element's outline, a ring around the box. "style.outline" is a glyph stroke that follows the letter shapes (shown as "Stroke" in the UI). Both use {paint, width, align}, width in design units. For "style.outline" only "center" align has any effect.
- "rotation" is degrees. "opacity" is 0-1.

ENUMS
- element "type": "text" | "shape"
- text "fit": ${list(textFitModes)}
  - "declared" uses style.fontSize verbatim and overflows if too long
  - "shrinkToFit" treats style.fontSize as a maximum and shrinks to fit
  - "fitNoWrap" picks the largest size that fits on one line per explicit newline
  - "wrap" picks the largest size that fits, wrapping freely
- style "align": ${list(horizontalAlignments)}
- style "valign": ${list(verticalAlignments)}
- style "fontStyle": "normal" | "italic"
- style "textTransform": ${list(textTransforms)} — casing applied at render time. Use this to uppercase a title rather than rewriting "content", which would destroy the author's original text.
- image and video fill "fit": ${list(imageFitModes)}
- shape "kind": ${list(shapeKinds)}
- document "fitMode": ${list(layoutFitModes)}

PRESERVE UNLESS ASKED
- Element "id" values. Other systems reference them; changing one silently breaks the slide.
- "{{token}}" placeholders inside text "content" and inside an image fill's "src". These are substituted with real data at render time, so the text you see in a token is not the text the audience sees. Never replace a token with literal example text.
- An existing image or video fill. A picture is a "fill" of type "image" and a video is a "fill" of type "video", on any element; both were chosen by the user from their own media library.`;

const IMAGE_GUIDANCE = `An image is attached as a VISUAL REFERENCE.
- Copy its composition: placement, proportion, alignment, colour, weight, casing.
- Do NOT copy its words. Any text in the image is sample content. Keep the existing "content" strings and "{{token}}" placeholders exactly as they are unless the request explicitly asks otherwise.`;

const AGENT_SYSTEM_PROMPT = `You edit slide layouts for a church presentation app, using tools.

WORKFLOW
- Call list_elements FIRST, every time. Element ids are not guessable and the layout may have changed since the last turn.
- Then make the smallest set of changes that satisfies the request.
- When you are finished, reply describing what you changed: one short sentence for a specific instruction, or one line per fault for the open-ended case below. Do not reply with JSON.
- If the request is not a layout change, just say so without calling any tool.

OPEN-ENDED REQUESTS
When the request is a judgement call rather than a specific instruction — "make it good", "improve this", "make it look more professional", "tidy it up" — do NOT start editing immediately. Diagnose first, in this order:
1. Call list_elements.
2. Work through the CRITIQUE CHECKLIST below and pick the 2-4 clearest, most specific faults. State each as the concrete defect, not a vague aim: "the title and the reference are both fontSize 4, so nothing leads" rather than "poor hierarchy".
3. Fix those faults, largest visual impact first.
4. Reply with the faults you found and what you did about each, one short line per fault.
A named fault produces a decisive fix. Skipping to "make it nicer" produces timid, arbitrary nudges, so do not skip step 2 even when the fix seems obvious.

CRITIQUE CHECKLIST
- Hierarchy: does one element clearly lead? Near-equal fontSize across elements of different importance is the most common fault, and the most worth fixing.
- Contrast: does every text fill actually read against the fill behind it? Check the values, do not assume.
- Alignment: do edges line up? Elements whose x differs by a small amount (say under 2) are almost certainly meant to share an edge and read as sloppy rather than deliberate.
- Margins: is anything crowding the slide edge, or is a block of dead space left stranded? Text closer than about 4 to any edge looks cramped and risks being cut off on real hardware.
- Crowding: are elements nearly touching each other? Space between blocks is what makes a slide look composed.
- Restraint: many fonts, many sizes or many colours reads as noise. Fewer, more deliberate choices look more professional almost every time.
- Legibility at distance: this is projected and read from the back of a room. Small text, thin weights, low contrast and long unbroken lines all fail there but look fine on a laptop.

GEOMETRY
- x and w are percent of slide WIDTH. y and h are percent of slide HEIGHT. All 0-100, x/y being the top-left corner.
- fontSize, letterSpacing and radius are design units, where 1 unit = 1% of slide WIDTH. On a 1920px slide, fontSize 6 is about 115px.

TEXT
- "{{token}}" placeholders are substituted with real data at render time. The text inside a token is NOT what the audience sees.
- Never remove or rewrite a token, and do not use set_text_content unless the request is explicitly about wording. Restyling, moving and resizing never require touching content.

BACKGROUNDS
- A background is a full-bleed shape: add_shape_element with kind 'rect', x 0, y 0, w 100, h 100 and order 'back'.
- Most layouts ALREADY have one, usually named "Background" and locked. Check list_elements first and recolour the existing one with set_fill rather than stacking a second on top of it.
- set_fill and add_shape_element both take a linear gradient as well as a flat colour.
- You have no way to pick a picture or a video: the media library is not available to you, so the backgrounds you can CREATE are colours and gradients only. Never claim to have added a photo, an image or a video.
- An element may nonetheless already have an image or video fill that the user picked. set_fill REPLACES the fill outright, so calling it on that element throws that media away. Restyle around it — move it, resize it, change what sits on top — unless the request is explicitly to remove it.
- After changing a background, check the text still reads against it and restyle the text colour if it does not. A dark background under dark text is the most common way this goes wrong.

JUDGEMENT
- Prefer editing what exists over adding or deleting. Deleting an element that carries a token silently blanks that content on every slide.
- "Bigger" on auto-sized text usually means a larger box, not a larger fontSize: with fit 'shrinkToFit' or 'wrap' the size is derived, so fontSize alone may change nothing visible.
- Prefer the targeted tools over replace_document. They cannot lose an id or a token, and each one is a step the user can see; a wholesale replacement is one opaque jump. Reach for it only for a redesign that the other tools would take a dozen calls to express.`;

export const buildLayoutAgentMessages = (
  request: string,
  history: LayoutAiTurn[] = [],
  imageDataUrl?: string | null,
): ChatMessage[] => {
  const text = [imageDataUrl ? IMAGE_GUIDANCE : null, `Request: ${request}`]
    .filter(Boolean)
    .join("\n\n");

  return [
    { role: "system", content: AGENT_SYSTEM_PROMPT },
    ...history.map((turn) => ({ role: turn.role, content: turn.content })),
    {
      role: "user",
      content: imageDataUrl
        ? [
            { type: "text" as const, text },
            { type: "image_url" as const, image_url: { url: imageDataUrl } },
          ]
        : text,
    },
  ];
};

const tokensOf = (doc: LayoutDoc): Set<string> => {
  const found = new Set<string>();
  for (const element of doc.elements) {
    const sources: string[] = [];
    if (element.type === "text") sources.push(element.content);
    if (
      element.fill?.type === "image" &&
      typeof element.fill.src === "string"
    ) {
      sources.push(element.fill.src);
    }

    for (const source of sources) {
      for (const match of source.matchAll(/{{\s*([\w.]+)\s*}}/g)) {
        if (match[1]) found.add(match[1]);
      }
    }
  }
  return found;
};

/**
 * Tokens that existed before an edit and do not survive it
 * For reporting, not enforcement
 */
export const droppedBindingTokens = (
  before: LayoutDoc,
  after: LayoutDoc,
): string[] => {
  const survived = tokensOf(after);
  return [...tokensOf(before)].filter((token) => !survived.has(token));
};
