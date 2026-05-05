import { makePluginByCombiningPlugins } from "graphile-utils";

import screenLoginPlugin from "./login";

export default makePluginByCombiningPlugins(
  screenLoginPlugin,
);
