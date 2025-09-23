import { makePluginByCombiningPlugins } from "graphile-utils";

import cloudPlugin from "../api/cloud";
import mediaPlugin from "../api/media";
import { pluginKeyPress } from "../api/pluginKeyPress";
import { pluginMeta } from "../api/pluginMeta";

export default makePluginByCombiningPlugins(
  pluginMeta,
  pluginKeyPress,
  ...mediaPlugin,
  ...cloudPlugin,
);
