import { Express } from "express";

import { serverPluginApi } from "../pluginManager";

export default (app: Express) => {
  const registeredPrivateRoute = serverPluginApi.getRegisteredPrivateRoute();

  for (const { pluginName, path, middleware } of registeredPrivateRoute) {
    app.use(`/plugin/${pluginName}/${path}`, middleware);
  }
};
