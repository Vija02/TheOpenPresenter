import { ServerPluginApi } from "@repo/base-plugin/server";
import aki from "aki-plugin-manager";
import chalk from "chalk";
import fs from "fs";
import path from "path";

const dir = path.join(__dirname, "../../../", "loadedPlugins");
const enabledPlugins = (process.env.ENABLED_PLUGINS ?? "").split(",");

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
}

export const serverPluginApi = new ServerPluginApiPrivate();

export const initPlugins = async () => {
  try {
    // Make sure plugins are available
    console.log("\nInitializing Plugin...");
    for (const pluginName of enabledPlugins) {
      // TODO: Handle non-local plugin
      await _linkPlugin(pluginName);
    }

    const plugins = aki.list(dir);

    // Now we can load them
    for (const [pluginName] of plugins) {
      const p = aki.load(dir, pluginName);
      if ("init" in p) {
        p.init(serverPluginApi);
      } else {
        console.warn(`Plugin ${pluginName} does not have a init function`);
      }
    }

    console.log(
      `${chalk.green(`${plugins.length} plugins initialized!`)} ${chalk.gray(plugins.map(([name, version]) => `${name}@${version}`).join(", "))}\n`,
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
