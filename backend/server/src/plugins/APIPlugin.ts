import { makePluginByCombiningPlugins } from "graphile-utils";

import { pluginKeyPress } from "../api/pluginKeyPress";
import { pluginMeta } from "../api/pluginMeta";

export default makePluginByCombiningPlugins(pluginMeta, pluginKeyPress);
