import { Express, static as staticMiddleware } from "express";
import path from "path";

import { serverPluginApi } from "../pluginManager";

export default (app: Express) => {
  const registeredServeStatic = serverPluginApi.getRegisteredServeStatic();

  for (const { pluginName, path: staticPath } of registeredServeStatic) {
    app.use(
      `/plugin/${pluginName}/static`,
      staticMiddleware(
        path.resolve(
          __dirname,
          "../../../loadedPlugins",
          pluginName,
          staticPath,
        ),
      ),
    );
  }
};
