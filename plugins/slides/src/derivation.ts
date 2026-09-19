import type { DerivationField } from "@repo/base-types";

export const OFFSET_PARAM = "offset";
export const SHOW_NOTES_PARAM = "showNotes";

export const derivationFields: DerivationField[] = [
  {
    key: OFFSET_PARAM,
    type: "number",
    label: "Step offset",
    default: 0,
    min: -20,
    max: 20,
    step: 1,
    help: "0 is live. 1 is the next step, -1 the previous. Animations/builds count as steps.",
  },
];
