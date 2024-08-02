import { makePluginByCombiningPlugins } from "graphile-utils";

import { pluginMeta } from "../api/pluginMeta";

export default makePluginByCombiningPlugins(pluginMeta);
