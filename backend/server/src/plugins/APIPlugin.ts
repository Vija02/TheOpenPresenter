import { makePluginByCombiningPlugins } from "graphile-utils";

import activeDevicePlugin from "../api/activeDevice";
import cloudPlugin from "../api/cloud";
import mediaPlugin from "../api/media";
import { pluginKeyPress } from "../api/pluginKeyPress";
import { pluginMeta } from "../api/pluginMeta";

export default makePluginByCombiningPlugins(
  pluginMeta,
  pluginKeyPress,
  ...activeDevicePlugin,
  ...mediaPlugin,
  ...cloudPlugin,
);
