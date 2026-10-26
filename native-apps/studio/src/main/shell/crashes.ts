import { app } from "electron";

import { reportDiagnosis } from "./diagnostics";
import { logShell } from "./log";

/**
 * Report crashes that nothing else catches: errors thrown in the main
 * process, and renderer or helper processes dying.
 *
 * Reasons are fixed strings so the diagnostics cooldown bounds how often each
 * kind is sent, however many distinct errors there are. The details go in
 * the bundle instead.
 */
export function setupCrashReporting(): void {
  const report = (reason: string, detail: string) => {
    logShell("error", `[crash] ${reason}:`, detail);
    // Development crashes are ours to read in the terminal, not to report.
    if (app.isPackaged) void reportDiagnosis(reason, detail);
  };

  const describe = (err: unknown) =>
    err instanceof Error ? (err.stack ?? err.message) : String(err);

  process.on("uncaughtException", (err) => {
    report("uncaught_exception", describe(err));
  });

  process.on("unhandledRejection", (reason) => {
    report("unhandled_rejection", describe(reason));
  });

  app.on("render-process-gone", (_event, contents, details) => {
    if (details.reason === "clean-exit") return;
    report(
      `render_process_gone: ${details.reason}`,
      `exitCode=${details.exitCode} url=${contents.getURL()}`,
    );
  });

  app.on("child-process-gone", (_event, details) => {
    if (details.reason === "clean-exit") return;
    report(
      `child_process_gone: ${details.type} ${details.reason}`,
      `exitCode=${details.exitCode} name=${details.name ?? ""} service=${details.serviceName ?? ""}`,
    );
  });
}
