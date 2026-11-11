import { registerCloudIPC } from "./cloud/ipc";
import { registerLocalSetupIPC } from "./local";
import { registerRuntimeIPC } from "./runtime/ipc";
import { registerScreensIPC } from "./screens/ipc";
import { registerSettingsIPC } from "./settings/ipc";
import { registerAppIPC } from "./shell/app-ipc";
import { registerPresentIPC } from "./shell/present-ipc";

export function registerIPC(): void {
  registerSettingsIPC();
  registerCloudIPC();
  registerRuntimeIPC();
  registerAppIPC();
  registerPresentIPC();
  registerLocalSetupIPC();
  registerScreensIPC();
}
