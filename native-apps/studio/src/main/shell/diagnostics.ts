import { app as electronApp, net } from "electron";
import { readFileSync, readdirSync, statSync } from "fs";
import { cpus } from "os";
import { join } from "path";

import { runtimeRoot } from "../settings/paths";

/** Reporting a crash to the cloud. */

/** Always-up instance that receives bundles, overridable for testing. */
const DIAGNOSTICS_CLOUD_HOST = "https://theopenpresenter.com";

/** Enough log to see what happened, small enough to post while degraded. */
const MAX_LOG_BYTES = 64 * 1024;
const MAX_LOG_LINES = 300;

type LogFile = { name: string; content: string; truncated: boolean };

function diagnosticsHost(): string {
  return (process.env.DIAGNOSTICS_CLOUD_HOST ?? DIAGNOSTICS_CLOUD_HOST).replace(
    /\/+$/,
    "",
  );
}

/**
 * The newest runtime log, tail-first.
 *
 * The end of a log is where a crash is; the beginning is startup noise, so a
 * truncated bundle keeps the last lines rather than the first.
 */
function collectLatestLog(): LogFile | null {
  try {
    const dir = join(runtimeRoot(), "logs");
    const newest = readdirSync(dir)
      .filter((name) => name.endsWith(".log"))
      .map((name) => {
        const path = join(dir, name);
        return { name, path, mtime: statSync(path).mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime)[0];

    if (!newest) return null;

    const raw = readFileSync(newest.path, "utf8");
    const lines = raw.split("\n");

    let truncated = false;
    let content = raw;
    if (lines.length > MAX_LOG_LINES) {
      content = lines.slice(-MAX_LOG_LINES).join("\n");
      truncated = true;
    }
    if (Buffer.byteLength(content, "utf8") > MAX_LOG_BYTES) {
      content = content.slice(-MAX_LOG_BYTES);
      truncated = true;
    }

    return { name: newest.name, content, truncated };
  } catch {
    // No logs yet, or unreadable. The report is still worth sending.
    return null;
  }
}

/** Reports of the same failure are suppressed for this long */
const REPORT_COOLDOWN_MS = 5 * 60 * 1000;
const lastReported = new Map<string, number>();

/**
 * Send a diagnosis bundle. Never throws: callers are already handling a
 * failure and must not have to guard this one too.
 */
export async function reportDiagnosis(
  reason: string,
  recentOutput = "",
): Promise<boolean> {
  const now = Date.now();
  const previous = lastReported.get(reason);
  if (previous !== undefined && now - previous < REPORT_COOLDOWN_MS) {
    return false;
  }
  lastReported.set(reason, now);

  try {
    const log = collectLatestLog();

    const body = {
      systemInfo: {
        source: "electron",
        reason,
        platform: process.platform,
        arch: process.arch,
        appName: electronApp.getName(),
        appVersion: electronApp.getVersion(),
        electron: process.versions.electron,
        node: process.versions.node,
        cpuCount: cpus().length,
        logDir: join(runtimeRoot(), "logs"),
        recentOutput: recentOutput.slice(-MAX_LOG_BYTES),
      },
      logs: log ? [log] : [],
    };

    const response = await net.fetch(
      `${diagnosticsHost()}/diagnostics/report`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // The endpoint requires this to reject cross-site form posts.
          "x-top-csrf-protection": "1",
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      console.error(`[diagnostics] report rejected: HTTP ${response.status}`);
      return false;
    }
    console.log("[diagnostics] report sent");
    return true;
  } catch (err) {
    console.error("[diagnostics] failed to send report:", err);
    return false;
  }
}
