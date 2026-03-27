import { UniversalURL } from "@repo/base-plugin";

export type PluginBaseData = {
  images: UniversalURL[];
};

export type AutoplayState = {
  enabled: boolean;
  loopDurationMs: number;
};

export type PluginRendererData = {
  imgIndex: number;
  lastClickTimestamp: number | null;
  autoplay: AutoplayState | null;
};
