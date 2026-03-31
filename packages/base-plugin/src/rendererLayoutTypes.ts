import { UUID } from "./types";

// Preset aspect ratios
export const layoutAspectRatioPresets = [
  { label: "16:9 (HD)", width: 16, height: 9 },
  { label: "16:10", width: 16, height: 10 },
  { label: "4:3", width: 4, height: 3 },
  { label: "21:9 (Ultrawide)", width: 21, height: 9 },
  { label: "1:1 (Square)", width: 1, height: 1 },
] as const;

// Aspect ratio stored as width/height values
export type LayoutAspectRatio = {
  width: number;
  height: number;
};

// Position and size of a scene in the layout (all values in percentage 0-100)
export type SceneLayoutPosition = {
  x: number; // left position (%)
  y: number; // top position (%)
  width: number; // width (%)
  height: number; // height (%)
};

export type DerivationConfig = {
  offset: number;
};

export type LayoutItemBase = {
  id: UUID;
  position: SceneLayoutPosition;
  label?: string;
  derivation: DerivationConfig | null;
};

export type SceneLayoutItem = LayoutItemBase & {
  type: "sceneItem";
  sourceRendererId: string;
  sceneId: UUID;
};

export type ScreenLayoutItem = LayoutItemBase & {
  type: "screenItem";
  sourceRendererId: string;
  sceneOverrides?: Record<UUID, DerivationConfig | null>;
};

export type LayoutItem = SceneLayoutItem | ScreenLayoutItem;

export type RendererLayout = {
  enabled: boolean;
  aspectRatio: LayoutAspectRatio;
  items: LayoutItem[];
};
