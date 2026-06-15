import { homedir } from "os";
import { join } from "path";

export const APP_ID = "com.theopenpresenter.desktop-universal";

export function xdgAutostartPath(): string {
  return join(homedir(), ".config", "autostart", `${APP_ID}.desktop`);
}
