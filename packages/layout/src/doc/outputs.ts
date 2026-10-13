import { MAIN_LOOK_KEY } from "@repo/base-types";

import { createHostElement, createLayoutDoc } from "../schema/defaults";
import { LayoutDoc } from "../schema/document";
import { HostElement } from "../schema/element";
import { readRendererLayoutDoc } from "./rendererLayout";

/**
 * A project may have multiple outputs. 
 * This maps to any different thing it can show.
 */
export type Output = {
  name: string;
  layout: LayoutDoc;
};

export type Outputs = Record<string, Output>;

/** The only program the UI offers, for now */
export const MAIN_PROGRAM_ID = "1";
export const MAIN_OUTPUT_ID = "1";

const PROGRAM_BOX_ID = "program";

export const createProgramBox = ({
  programId = MAIN_PROGRAM_ID,
  look = null,
  followOverlay = true,
}: {
  programId?: string;
  look?: string | null;
  followOverlay?: boolean;
} = {}): HostElement =>
  createHostElement({
    id: PROGRAM_BOX_ID,
    name: "Live",
    source: { kind: "screen", rendererId: programId },
    look: look === MAIN_LOOK_KEY ? null : look,
    followOverlay,
    rect: { x: 0, y: 0, w: 100, h: 100 },
  });

/** Fluid, so it fills whatever screen it is shown on */
export const createSimpleOutputLayout = (
  options: Parameters<typeof createProgramBox>[0] = {},
): LayoutDoc =>
  createLayoutDoc({ fitMode: "fluid", elements: [createProgramBox(options)] });

/** What a simple output shows. Null for a custom layout */
export const simpleOutputInfo = (
  layout: LayoutDoc,
): { programId: string; look: string; followOverlay: boolean } | null => {
  if (layout.elements.length !== 1) return null;
  const [box] = layout.elements;
  if (box?.type !== "host" || box.source.kind !== "screen") return null;
  return {
    programId: box.source.rendererId,
    look: box.look ?? MAIN_LOOK_KEY,
    followOverlay: box.followOverlay !== false,
  };
};

type StoredState = {
  renderer: Record<
    string,
    { layout?: { enabled?: boolean; doc?: unknown } | null } | undefined
  >;
  outputs?: Outputs | null;
};

const byNumericId = (a: string, b: string) => {
  const na = parseInt(a, 10);
  const nb = parseInt(b, 10);
  if (Number.isNaN(na) || Number.isNaN(nb)) return a.localeCompare(b);
  return na - nb;
};

/**
 * A screen from before outputs. Its custom layout is already an output's
 * layout: its boxes point at renderers, which are programs. Boxes showing
 * another screen didn't go black with it, so they keep ignoring its Black
 */
const legacyOutput = (
  rendererId: string,
  renderer: StoredState["renderer"][string],
): Output => {
  const custom = renderer?.layout?.enabled
    ? readRendererLayoutDoc(renderer.layout)
    : null;

  return {
    name: rendererId === MAIN_OUTPUT_ID ? "Main" : `Screen ${rendererId}`,
    layout: custom
      ? {
          ...custom,
          elements: custom.elements.map((element) =>
            element.type === "host"
              ? {
                  ...element,
                  look: element.look ?? null,
                  followOverlay:
                    element.source.kind === "self" ||
                    element.source.rendererId === rendererId,
                }
              : element,
          ),
        }
      : createSimpleOutputLayout({ programId: rendererId }),
  };
};

export const readOutputs = (state: StoredState): Outputs => {
  if (state.outputs && Object.keys(state.outputs).length > 0) {
    return state.outputs;
  }

  const outputs: Outputs = {};
  for (const id of Object.keys(state.renderer ?? {}).sort(byNumericId)) {
    outputs[id] = legacyOutput(id, state.renderer[id]);
  }
  if (!outputs[MAIN_OUTPUT_ID]) {
    outputs[MAIN_OUTPUT_ID] = {
      name: "Main",
      layout: createSimpleOutputLayout(),
    };
  }
  return outputs;
};

export const sortedOutputIds = (outputs: Outputs): string[] =>
  Object.keys(outputs).sort(byNumericId);

export const nextOutputId = (outputs: Outputs): string => {
  const numeric = Object.keys(outputs)
    .map((id) => parseInt(id, 10))
    .filter((id) => !Number.isNaN(id));
  return String(Math.max(0, ...numeric) + 1);
};

export const outputProgramId = (outputs: Outputs, outputId: string): string => {
  const output = outputs[outputId];
  if (!output) return outputId;
  for (const element of output.layout.elements) {
    if (element.type === "host" && element.source.kind !== "self") {
      return element.source.rendererId;
    }
  }
  return MAIN_PROGRAM_ID;
};
