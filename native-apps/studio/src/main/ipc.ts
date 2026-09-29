import { registerCloudIPC } from "./cloud/ipc";
import { registerRuntimeIPC } from "./runtime/ipc";
import { registerSettingsIPC } from "./settings/ipc";
import { registerAppIPC } from "./shell/app-ipc";
import { registerPresentIPC } from "./shell/present-ipc";

export function registerIPC(): void {
  registerSettingsIPC();
  registerCloudIPC();
  registerRuntimeIPC();
  registerAppIPC();
  registerPresentIPC();
}
