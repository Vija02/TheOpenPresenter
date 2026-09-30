/**
 * Makes Electron-as-node look like plain node to argv parsers.
 */
if (process.versions.electron && !process.defaultApp) {
  Object.defineProperty(process, "defaultApp", {
    value: true,
    configurable: true,
  });
}
