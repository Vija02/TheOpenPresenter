import type { DataBinding, Derivation } from "@repo/base-types";

export type FeedDataContext<Scene = any, Renderer = any> = {
  sceneData: Scene;
  rendererData: Renderer;
  /** The feed's derivation, e.g. `{ offset: 1 }` for the next step. */
  derivation: Derivation | null;
};

export type FeedData = Record<string, unknown>;

export type FeedDataProvider<Scene = any, Renderer = any> = {
  /** Tokens this plugin offers, for the layout editor's insert chips. */
  bindings: DataBinding[];
  /** Called whenever the Yjs data changes. */
  getData: (ctx: FeedDataContext<Scene, Renderer>) => FeedData;
  isLive?: (ctx: FeedDataContext<Scene, Renderer>) => boolean;
};
