import { PluginRendererState } from "@repo/base-plugin";

export type PluginBaseData = {
  isSharing: boolean;
  sharerAwarenessUserId: string | null;
  sessionId: string | null;
};

export type PluginRendererData = PluginRendererState & {};

export type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};
