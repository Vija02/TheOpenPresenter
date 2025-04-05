import { ServerPluginApiPrivate } from "@repo/base-plugin/server";
import aki from "aki-plugin-manager";
import { Express } from "express";
import fs, { readdirSync, statSync } from "fs";
import path from "path";

export const pluginsPath =
  process.env.PLUGINS_PATH ??
  path.join(__dirname, "../../../", "loadedPlugins");
const enabledPlugins = process.env.ENABLED_PLUGINS
  ? process.env.ENABLED_PLUGINS.split(",")
  : [];

export let serverPluginApi: ServerPluginApiPrivate;

export const initPlugins = async (app: Express) => {
  serverPluginApi = new ServerPluginApiPrivate(app);

  const { default: chalk } = await import("chalk");

  try {
    // Make sure plugins are available
    console.log("\nInitializing Plugin...");
    if (enabledPlugins.length === 0) {
      console.log(
        "No plugins enabled. Specify the plugins through the ENABLED_PLUGINS environment variable",
      );
    }

    fs.mkdirSync(pluginsPath, { recursive: true });

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

    // Cleanup plugins before we continue
    for (const name of readdirSync(pluginsPath)) {
      try {
        statSync(path.join(pluginsPath, name));
      } catch (e) {
        fs.rmSync(path.join(pluginsPath, name), { recursive: true });
      }
    }

    const plugins = aki.list(pluginsPath);

    const initializedPlugins = [];

    // Now we can load them
    for (const [pluginName, version] of plugins) {
      try {
        const p = aki.load(pluginsPath, pluginName);
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
      fs.readdirSync(path.resolve(pluginsPath, pluginName));
      return;
    } catch (e) {
      // If here, then it doesn't exist. So we let it go
    }

    const localPluginDir = path.resolve(`${__dirname}/../../../plugins/`);
    const localPluginDirData = fs.readdirSync(localPluginDir);
    if (localPluginDirData.includes(pluginName)) {
      fs.symlinkSync(
        path.resolve(localPluginDir, pluginName),
        path.resolve(pluginsPath, pluginName),
      );
    } else {
      console.warn(`Linking local plugin '${pluginName}' failed`);
    }
  } catch (e) {
    console.error(e);
    console.error(`ERROR: Failed to link plugin '${pluginName}'`);
  }
};
