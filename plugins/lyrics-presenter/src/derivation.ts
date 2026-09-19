import type { DerivationField } from "@repo/base-types";

export const OFFSET_PARAM = "offset";

export const derivationFields: DerivationField[] = [
  {
    key: OFFSET_PARAM,
    type: "number",
    label: "Slide offset",
    default: 0,
    min: -20,
    max: 20,
    step: 1,
    help: "0 is the live slide. 1 is the next one, -1 the previous.",
  },
];
