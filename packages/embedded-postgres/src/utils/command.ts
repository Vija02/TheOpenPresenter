import { spawn, type ChildProcess } from "child_process";
import type { CommandOptions } from "../types/index.js";

export const runCommand = async (
  command: string,
  args: string[],
  options: CommandOptions = {}
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const childProcess: ChildProcess = spawn(command, args, {
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

export const runCommandWithOutput = async (
  command: string,
  args: string[],
  options: CommandOptions = {}
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const childProcess: ChildProcess = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
    });

    let stdout = "";
    let stderr = "";

    childProcess.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    childProcess.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    childProcess.on("close", (code: number | null) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Process exited with code ${code}. stderr: ${stderr}`));
      }
    });

    childProcess.on("error", (err: Error) => {
      reject(err);
    });
  });
};