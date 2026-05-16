import { makePluginByCombiningPlugins } from "graphile-utils";

import screenControlRequestPlugin from "./controlRequest";
import screenKeyPressPlugin from "./keyPress";
import screenLoginPlugin from "./login";

export default makePluginByCombiningPlugins(
  screenLoginPlugin,
  screenControlRequestPlugin,
  screenKeyPressPlugin,
);
