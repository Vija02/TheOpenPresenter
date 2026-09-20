import type { DataBinding } from "@repo/base-types";

export const NOTES_BINDING = "notes";
export const SLIDE_NUMBER_BINDING = "slideNumber";
export const SLIDE_COUNT_BINDING = "slideCount";
export const IMPORT_NAME_BINDING = "importName";

/** The tokens a layout may read from a slides feed. */
export const dataBindings: DataBinding[] = [
  { key: NOTES_BINDING, label: "Speaker notes", type: "text" },
  { key: SLIDE_NUMBER_BINDING, label: "Slide number", type: "text" },
  { key: SLIDE_COUNT_BINDING, label: "Slide count", type: "text" },
  { key: IMPORT_NAME_BINDING, label: "Deck name", type: "text" },
];
