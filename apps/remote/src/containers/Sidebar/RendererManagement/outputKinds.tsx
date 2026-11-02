import {
  BUILT_IN_LOOK_KEYS,
  CONFIDENCE_LOOK_KEY,
  MAIN_LOOK_KEY,
  OVERLAY_LOOK_KEY,
  ProjectLooks,
} from "@repo/base-plugin";
import { rootLookKey } from "@repo/layout";
import { IconType } from "react-icons";
import {
  MdDashboardCustomize,
  MdLayers,
  MdOutlineSpeakerNotes,
  MdTv,
} from "react-icons/md";

export type OutputKind = "main" | "confidence" | "overlay" | "custom";

type KindInfo = {
  icon: IconType;
  title: string;
  description: string;
};

export const OUTPUT_KINDS: Record<OutputKind, KindInfo> = {
  main: {
    icon: MdTv,
    title: "Main view",
    description: "What the audience sees",
  },
  confidence: {
    icon: MdOutlineSpeakerNotes,
    title: "Confidence monitor",
    description: "What's live, what's next and notes, for people on stage",
  },
  overlay: {
    icon: MdLayers,
    title: "Overlay",
    description: "Lower thirds on a see-through background, for a livestream",
  },
  custom: {
    icon: MdDashboardCustomize,
    title: "Custom layout",
    description: "Live content, text and shapes, arranged by you",
  },
};

export const SIMPLE_KINDS: {
  kind: OutputKind;
  lookKey: string;
  plural: string;
}[] = [
  { kind: "main", lookKey: MAIN_LOOK_KEY, plural: "Main view" },
  {
    kind: "confidence",
    lookKey: CONFIDENCE_LOOK_KEY,
    plural: "Confidence monitors",
  },
  { kind: "overlay", lookKey: OVERLAY_LOOK_KEY, plural: "Overlays" },
];

export const kindOfLook = (
  looks: ProjectLooks | null | undefined,
  lookKey: string,
): OutputKind => {
  const root = rootLookKey(looks, lookKey);
  return SIMPLE_KINDS.find((entry) => entry.lookKey === root)?.kind ?? "main";
};

export const lookName = (
  looks: ProjectLooks | null | undefined,
  lookKey: string,
): string =>
  looks?.[lookKey]?.name ??
  BUILT_IN_LOOK_KEYS.find((look) => look.key === lookKey)?.name ??
  lookKey;

/** "Confidence monitor", then "Confidence monitor 2", ... */
export const uniqueName = (taken: string[], base: string): string => {
  const names = new Set(taken.map((name) => name.trim().toLowerCase()));
  if (!names.has(base.toLowerCase())) return base;
  let n = 2;
  while (names.has(`${base} ${n}`.toLowerCase())) n += 1;
  return `${base} ${n}`;
};
