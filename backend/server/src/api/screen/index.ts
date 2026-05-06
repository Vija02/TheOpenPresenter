import { makePluginByCombiningPlugins } from "graphile-utils";

import screenControlRequestPlugin from "./controlRequest";
import screenLoginPlugin from "./login";

export default makePluginByCombiningPlugins(
  screenLoginPlugin,
  screenControlRequestPlugin,
);
