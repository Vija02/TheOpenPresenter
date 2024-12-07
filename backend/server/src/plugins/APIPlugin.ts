import { makePluginByCombiningPlugins } from "graphile-utils";

import { pluginKeyPress } from "../api/pluginKeyPress";
import { pluginMeta } from "../api/pluginMeta";
import { sceneState } from "../api/sceneState";

export default makePluginByCombiningPlugins(
  pluginMeta,
  pluginKeyPress,
  sceneState,
);
