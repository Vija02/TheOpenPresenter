import { type ChildProcess, spawn } from "child_process";
import { fileURLToPath } from "url";

import type { CommandOptions } from "../types/index.js";

const argvShim = fileURLToPath(
  new URL("./electronArgvShim.cjs", import.meta.url),
);

export const runCommand = async (
  command: string,
  args: string[],
  options: CommandOptions = {},
): Promise<void> => {
  return new Promise((resolve, reject) => {
    // `defaultApp` is an Electron-only property, absent from Node's types.
    const isElectronAsNode =
      !!process.versions.electron &&
      !(process as NodeJS.Process & { defaultApp?: boolean }).defaultApp;

    const finalArgs = isElectronAsNode
      ? ["--require", argvShim, ...args]
      : args;

    const childProcess: ChildProcess = spawn(command, finalArgs, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: "inherit",
    });

    childProcess.on("close", (code: number | null) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });

    childProcess.on("error", (err: Error) => {
      reject(err);
    });
  });
};
