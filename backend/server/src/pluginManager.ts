import { ServerPluginApi } from "@repo/base-plugin/server";
import aki from "aki-plugin-manager";
import fs from "fs";
import path from "path";

const dir = path.join(__dirname, "../../../", "loadedPlugins");
const enabledPlugins = process.env.ENABLED_PLUGINS
  ? process.env.ENABLED_PLUGINS.split(",")
  : [];

// Class to access the data in ServerPluginApi
class ServerPluginApiPrivate extends ServerPluginApi {
  getRegisteredTrpcAppRouter() {
    return this.registeredTrpcAppRouter;
  }
  getRegisteredOnPluginDataCreated() {
    return this.registeredOnPluginDataCreated;
  }
  getRegisteredOnPluginDataLoaded() {
    return this.registeredOnPluginDataLoaded;
  }
  getRegisteredOnRendererDataCreated() {
    return this.registeredOnRendererDataCreated;
  }
  getRegisteredOnRendererDataLoaded() {
    return this.registeredOnRendererDataLoaded;
  }
  getRegisteredServeStatic() {
    return this.registeredServeStatic;
  }
  getRegisteredLoadJsOnRemoteView() {
    return this.registeredLoadJsOnRemoteView;
  }
  getRegisteredLoadCssOnRemoteView() {
    return this.registeredLoadCssOnRemoteView;
  }
  getRegisteredRemoteViewWebComponent() {
    return this.registeredRemoteViewWebComponent;
  }
  getRegisteredLoadJsOnRendererView() {
    return this.registeredLoadJsOnRendererView;
  }
  getRegisteredLoadCssOnRendererView() {
    return this.registeredLoadCssOnRendererView;
  }
  getRegisteredRendererViewWebComponent() {
    return this.registeredRendererViewWebComponent;
  }
  getRegisteredSceneCreator() {
    return this.registeredSceneCreator;
  }
  getRegisteredPrivateRoute() {
    return this.registeredPrivateRoute;
  }
  getRegisteredKeyPressHandler() {
    return this.registeredKeyPressHandler;
  }
  getRegisteredCSPDirectives() {
    return this.registeredCSPDirectives;
  }
  getRegisteredEnvToViews() {
    return this.registeredEnvToViews;
  }
}

export const serverPluginApi = new ServerPluginApiPrivate();

export const initPlugins = async () => {
  const { default: chalk } = await import("chalk");

  try {
    // Make sure plugins are available
    console.log("\nInitializing Plugin...");
    if (enabledPlugins.length === 0) {
      console.log(
        "No plugins enabled. Specify the plugins through the ENABLED_PLUGINS environment variable",
      );
    }

    fs.mkdirSync(dir, { recursive: true });

    for (const pluginName of enabledPlugins) {
      try {
        // TODO: Handle non-local plugin
        await _linkPlugin(pluginName);
      } catch (e) {
        console.error(e);
        console.error(
          `ERROR: Failed to install the '${pluginName}' plugin. Skipping...`,
        );
      }
    }

    const plugins = aki.list(dir);

    const initializedPlugins = [];

    // Now we can load them
    for (const [pluginName, version] of plugins) {
      try {
        const p = aki.load(dir, pluginName);
        if ("init" in p) {
          p.init(serverPluginApi);
          initializedPlugins.push([pluginName, version]);
        } else {
          throw new Error(
            `Plugin ${pluginName} does not have an init function`,
          );
        }
      } catch (e) {
        console.error(e);
        console.error(
          `ERROR: Plugin '${pluginName}' installed but failed to call the init function. Skipping...`,
        );
      }
    }

    console.log(
      `${chalk.green(`${initializedPlugins.length} plugins initialized!`)} ${chalk.gray(initializedPlugins.map(([name, version]) => `${name}@${version}`).join(", "))}\n`,
    );
  } catch (e) {
    console.error(e);
    console.error("ERROR: Failed to initialize plugins");
  }
};

const _linkPlugin = async (pluginName: string) => {
  try {
    try {
      fs.readdirSync(path.resolve(dir, pluginName));
      return;
    } catch (e) {
      // If here, then it doesn't exist. So we let it go
    }

    const localPluginDir = path.resolve(`${__dirname}/../../../plugins/`);
    const localPluginDirData = fs.readdirSync(localPluginDir);
    if (localPluginDirData.includes(pluginName)) {
      fs.symlinkSync(
        path.resolve(localPluginDir, pluginName),
        path.resolve(dir, pluginName),
      );
    } else {
      console.warn(`Linking local plugin '${pluginName}' failed`);
    }
  } catch (e) {
    console.error(e);
    console.error(`ERROR: Failed to link plugin '${pluginName}'`);
  }
};
