import loadjs from "loadjs";

import { appData } from "./appData";

type Preloader = {
  [k: string]: Promise<any>[];
};

const loadjsPromise = (fileName: string) =>
  new Promise<void>((resolve, reject) =>
    loadjs(fileName, { success: resolve, error: reject }),
  );

async function importWithRetry(
  type: "js" | "css",
  moduleUrl: string,
  maxAttempts = 5,
  baseDelay = 1000,
) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Browser doesn't retry failed dynamic import. So we append this query to bust the cache
      // More info: https://github.com/whatwg/html/issues/6768
      // Reference: https://github.com/fatso83/retry-dynamic-import
      const url = moduleUrl + (attempt !== 1 ? `?t=${+new Date()}` : "");
      if (type === "js") {
        return await import(/* @vite-ignore */ url);
      } else {
        return await loadjsPromise(url);
      }
    } catch (error: any) {
      if (attempt === maxAttempts) {
        throw new Error(
          `Failed to load module after ${maxAttempts} attempts: ${"message" in error ? error?.message : JSON.stringify(error)}`,
        );
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.warn(
        `Module load failed, retrying in ${delay}ms (attempt ${attempt} of ${maxAttempts}). Context: ${moduleUrl}`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

const setPreloader = (preloader: Preloader) => {
  (window as any).__PRELOADER__ = preloader;
};
const getPreloader = () => (window as any).__PRELOADER__ as Preloader;

const getPluginPromise = (pluginName: string) =>
  Promise.all(((window as any).__PRELOADER__ as Preloader)?.[pluginName] ?? []);

const initPreloader = () => {
  const pluginData = appData.getPluginData();

  const promises = Object.fromEntries(
    Object.keys(pluginData).map((pluginName) => [
      pluginName,
      [] as Promise<any>[],
    ]),
  );

  Object.entries(pluginData).forEach(([pluginName, plugin]) => {
    plugin.scripts.forEach((script) => {
      promises[pluginName]!.push(importWithRetry("js", script));
    });
    plugin.css.forEach((css) => {
      promises[pluginName]!.push(importWithRetry("css", css));
    });
  });

  preloader.setPreloader(promises);
};

export const preloader = {
  setPreloader,
  getPreloader,
  getPluginPromise,
  initPreloader,
};
