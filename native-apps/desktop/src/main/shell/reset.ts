import { dialog } from "electron";

import { runtime } from "../runtime/client";
import { clearSettings } from "../settings/store";
import { backToShellUI, getMainWindow } from "./windows";

export async function resetSetup(): Promise<void> {
  const window = getMainWindow();

  const options = {
    type: "warning" as const,
    buttons: ["Cancel", "Clear and reset"],
    defaultId: 0,
    cancelId: 0,
    message: "Clear data and start again?",
    detail:
      "Forgets the server, sign-in and mode, so the next launch begins " +
      "at onboarding.\n\nThe downloaded runtime and its data are kept. " +
      "Use Open data folder if you want to remove them by hand first.",
  };

  const { response } = window
    ? await dialog.showMessageBox(window, options)
    : await dialog.showMessageBox(options);
  if (response !== 1) return;

  // A running server belongs to the mode being forgotten.
  await runtime.stopRuntime(true).catch(() => undefined);
  clearSettings();
  backToShellUI();
}
