import { execFileSync } from "child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { RuntimeClient } from "../src/main/runtime/client";

/**
 * Drives the real `top-runtime-manager` binary through the same client the
 * shell uses, to catch protocol drift: both sides have their own tests, but
 * nothing else proves they agree on the wire format. An unbuilt manager fails
 * loudly rather than skipping.
 */

const MANAGER_DIR = resolve(__dirname, "../../runtime-manager");
const CARGO_TARGET = join(MANAGER_DIR, "target/debug");

function bin(name: string): string {
  return join(
    CARGO_TARGET,
    process.platform === "win32" ? `${name}.exe` : name,
  );
}

let root: string;
let cdn: string;
let publicKey: string;

beforeAll(() => {
  if (!existsSync(bin("top-runtime-manager"))) {
    throw new Error(
      `Runtime manager not built. Run \`cargo build\` in ${MANAGER_DIR} first.`,
    );
  }

  root = mkdtempSync(join(tmpdir(), "top-runtime-root-"));
  cdn = mkdtempSync(join(tmpdir(), "top-runtime-cdn-"));
  const keyDir = mkdtempSync(join(tmpdir(), "top-runtime-key-"));
  const runtimeSrc = mkdtempSync(join(tmpdir(), "top-runtime-src-"));

  // Keep the private half; the public half is derived below.
  const privateKey = execFileSync(bin("top-runtime-keygen"), ["--private"], {
    encoding: "utf8",
  }).trim();
  const keyFile = join(keyDir, "release.key");
  writeFileSync(keyFile, privateKey);

  // Derived the same way ed25519 does, using Node's crypto rather than another
  // dependency.
  publicKey = derivePublicKey(privateKey);

  // Has to genuinely listen: the manager waits for the port to answer before
  // reporting a successful start, so a fixture that only printed the
  // announcement would pass while the real thing handed back a dead URL.
  mkdirSync(runtimeSrc, { recursive: true });
  writeFileSync(
    join(runtimeSrc, "run_server.mjs"),
    [
      'import http from "node:http";',
      "const port = Number(process.env.TOP_HTTP_PORT);",
      "http",
      "  .createServer((req, res) => {",
      "    res.writeHead(200);",
      '    res.end("ok");',
      "  })",
      '  .listen(port, "127.0.0.1", () =>',
      '    console.log("TOP_LISTENING " + port),',
      "  );",
      'process.stdin.on("data", (d) => {',
      '  if (String(d).includes("shutdown")) process.exit(0);',
      "});",
      "process.stdin.resume();",
      "",
    ].join("\n"),
  );

  execFileSync(bin("top-runtime-publish"), [
    "--runtime",
    runtimeSrc,
    "--version",
    "1.0.0",
    "--schema",
    "1",
    "--entry",
    "run_server.mjs",
    "--out",
    cdn,
    "--key",
    keyFile,
  ]);
});

function derivePublicKey(privateKeyB64: string): string {
  // ed25519 private keys are a 32-byte seed. A PKCS#8 wrapper lets Node's
  // crypto derive the public half.
  const seed = Buffer.from(privateKeyB64, "base64");
  const pkcs8 = Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"),
    seed,
  ]);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const crypto = require("crypto") as typeof import("crypto");
  const keyObject = crypto.createPrivateKey({
    key: pkcs8,
    format: "der",
    type: "pkcs8",
  });
  const spki = crypto.createPublicKey(keyObject).export({
    format: "der",
    type: "spki",
  }) as Buffer;
  // The raw 32-byte key is the tail of the SPKI structure.
  return spki.subarray(spki.length - 32).toString("base64");
}

describe("RuntimeClient against the real manager binary", () => {
  let client: RuntimeClient;

  beforeAll(() => {
    process.env.TOP_RUNTIME_PUBKEY = publicKey;
    client = new RuntimeClient();
    // The client normally resolves from resources or the release build.
    Object.defineProperty(RuntimeClient, "binaryPath", {
      value: () => bin("top-runtime-manager"),
    });
    client.start({ root, source: cdn });
  });

  afterAll(async () => {
    await client.shutdown();
  });

  it("reports an empty status before anything is installed", async () => {
    const status = await client.status();
    expect(status.current).toBeNull();
    expect(status.installed).toEqual([]);
    expect(status.running).toBe(false);
  });

  it("resolves the channel to the published version", async () => {
    const result = await client.check("stable");
    expect(result.version).toBe("1.0.0");
  });

  it("installs the runtime and emits progress", async () => {
    const phases: string[] = [];
    client.on("progress", (payload: { phase: string }) =>
      phases.push(payload.phase),
    );

    const result = await client.ensure("stable");
    expect(result.version).toBe("1.0.0");
    expect(phases.some((phase) => phase === "assemble")).toBe(true);

    const status = await client.status();
    expect(status.current).toBe("1.0.0");
    expect(status.installed).toContain("1.0.0");
  });

  it("starts the runtime on a dynamically allocated port", async () => {
    const started = await client.startRuntime();
    expect(started.version).toBe("1.0.0");
    expect(started.httpPort).toBeGreaterThan(1024);
    // The hardcoded port was the reason two instances could not coexist.
    expect(started.httpPort).not.toBe(5678);

    const status = await client.status();
    expect(status.running).toBe(true);
  });

  /**
   * Two callers can race in the seconds between `start` and the server
   * reporting `listening`. Before coalescing, the second got "A runtime is
   * already running", which surfaced as a failure while the server came up.
   */
  it("coalesces concurrent starts instead of failing the second", async () => {
    const [first, second] = await Promise.all([
      client.startRuntime(),
      client.startRuntime(),
    ]);

    expect(second.httpPort).toBe(first.httpPort);

    const status = await client.status();
    expect(status.running).toBe(true);
  });

  /**
   * The bug this pins: opening the app while a runtime was already serving
   * left `url` null, so startup navigated to an empty string and the window
   * sat on "Starting up" forever.
   *
   * An adopted runtime never emits `listening` to the adopting process, so
   * the URL has to come from the start reply itself. A second client against
   * the same root is exactly what a second app launch looks like.
   */
  it("knows the URL of a runtime it adopted rather than started", async () => {
    await client.startRuntime();
    expect(client.url).toBeTruthy();

    const second = new RuntimeClient();
    second.start({ root, source: cdn });
    try {
      // Nothing has emitted `listening` to this client.
      expect(second.url).toBeNull();

      const adopted = await second.startRuntime();
      expect(adopted.url).toBeTruthy();
      expect(second.url).toBe(adopted.url);
      expect(second.url).toBe(client.url);
    } finally {
      await second.shutdown();
    }
  });

  it("stops the runtime cleanly", async () => {
    await client.stopRuntime();
    const status = await client.status();
    expect(status.running).toBe(false);
  });

  it("surfaces manager errors as rejected promises", async () => {
    await expect(client.check("no-such-channel")).rejects.toThrow();
  });
});
