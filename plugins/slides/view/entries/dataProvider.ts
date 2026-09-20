import {
  FeedDataProvider,
  registerFeedDataProvider,
} from "@repo/base-plugin/client";

import { dataBindings } from "../../src/bindings";
import { pluginName } from "../../src/consts";
import { getSlidesFeedData } from "../../src/feed/getData";

const subscribe: FeedDataProvider["subscribe"] = (ctx, emit) => {
  if (!ctx.rendererData?.autoplay?.enabled) return () => {};

  let frame: number;
  const tick = () => {
    emit(getSlidesFeedData(ctx));
    frame = window.requestAnimationFrame(tick);
  };
  frame = window.requestAnimationFrame(tick);

  return () => window.cancelAnimationFrame(frame);
};

registerFeedDataProvider(pluginName, {
  bindings: dataBindings,
  getData: getSlidesFeedData,
  subscribe,
});
