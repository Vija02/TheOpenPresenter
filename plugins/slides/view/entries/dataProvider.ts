import { registerFeedDataProvider } from "@repo/base-plugin/client";

import { dataBindings } from "../../src/bindings";
import { pluginName } from "../../src/consts";
import { getSlidesFeedData } from "../../src/feed/getData";

registerFeedDataProvider(pluginName, {
  bindings: dataBindings,
  getData: getSlidesFeedData,
  isLive: (ctx) => !!ctx.rendererData?.autoplay?.enabled,
});
