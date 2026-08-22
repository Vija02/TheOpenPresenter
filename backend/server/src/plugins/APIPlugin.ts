import { makePluginByCombiningPlugins } from "graphile-utils";

import activeDevicePlugin from "../api/activeDevice";
import clientPlugin from "../api/clientPlugin";
import cloudPlugin from "../api/cloud";
import mediaPlugin from "../api/media";
import { pluginKeyPress } from "../api/pluginKeyPress";
import { pluginMeta } from "../api/pluginMeta";
import screenControlPlugin from "../api/screen";

export default makePluginByCombiningPlugins(
  pluginMeta,
  pluginKeyPress,
  screenControlPlugin,
  ...clientPlugin,
  ...activeDevicePlugin,
  ...mediaPlugin,
  ...cloudPlugin,
);
