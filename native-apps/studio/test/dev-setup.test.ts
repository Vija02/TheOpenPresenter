import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { join, resolve } from "path";
import { describe, expect, it } from "vitest";

/**
 * The developer-experience contract for offline mode. The failure pinned down
 * here is not a crash: `npm run dev` produced a working app whose offline mode
 * reported "the runtime manager is not running", from two silent causes. The
 * sidecar was never built, and the manager exited immediately because no
 * signing key was baked in.
 */

const DESKTOP = resolve(__dirname, "..");
const MANAGER_DIR = resolve(DESKTOP, "../runtime-manager");
const EXE = process.platform === "win32" ? ".exe" : "";

describe("offline mode is usable straight after a dev build", () => {
  it("prepare:sidecar puts the binary where the shell looks for it", () => {
    // `binaryPath()` checks resources/ first in development so dev and
    // packaged builds resolve it identically.
    const staged = join(DESKTOP, "resources", `top-runtime-manager${EXE}`);
    expect(
      existsSync(staged),
      `Expected the sidecar at ${staged}. Run \`npm run prepare:sidecar\`.`,
    ).toBe(true);
  });

  it("the built manager runs without any environment set up", () => {
    // The one that actually broke: with an empty DEFAULT_PUBKEY_B64 the
    // manager exits before reading a command, so every runtime IPC call failed
    // and the UI could only say "not running".
    const binary = join(DESKTOP, "resources", `top-runtime-manager${EXE}`);

    const output = execFileSync(binary, ["--root", "/tmp/top-dev-check"], {
      input: '{"id":1,"cmd":"status"}\n{"cmd":"shutdown"}\n',
      encoding: "utf8",
      // Deliberately no TOP_RUNTIME_PUBKEY: a fresh clone has none.
      env: { PATH: process.env.PATH ?? "" },
      timeout: 20_000,
    });

    const reply = output
      .split("\n")
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .find((msg) => msg?.id === 1);

    expect(reply, `no response in output:\n${output}`).toBeTruthy();
    expect(reply.ok).toBe(true);
  });
});
