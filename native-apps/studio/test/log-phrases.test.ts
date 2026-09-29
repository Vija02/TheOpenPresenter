import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { describeLogLine } from "../src/renderer/loading/phase";

/**
 * The status line matches strings the runtime prints, which live elsewhere in
 * the repo and are not typechecked against this file: rewording a log line
 * would silently stop the loading window naming that step.
 *
 * These tests read the server source and fail when a string it no longer
 * prints is still matched on, so the drift surfaces here instead of as a blank
 * status line on a slow Windows machine.
 */
const SOURCES = [
  join(__dirname, "../../../tauri/node-server/run_server.mjs"),
  join(
    __dirname,
    "../../../packages/embedded-postgres/src/EmbeddedPostgresManager.ts",
  ),
];

describe("log phrases the loading window depends on", () => {
  const source = SOURCES.map((p) => readFileSync(p, "utf8")).join("\n");

  // Only phrases we print ourselves. PostgreSQL's "database system is ready"
  // and "listening on port" come from dependencies.
  const OWNED = [
    "Initializing node server",
    "Running migrations",
    "Starting Worker",
    "Starting Node Server",
  ];

  for (const phrase of OWNED) {
    it(`"${phrase}" is still printed by the runtime`, () => {
      expect(source).toContain(phrase);
    });
  }

  it("every owned phrase still maps to a message", () => {
    for (const phrase of OWNED) {
      expect(describeLogLine(phrase)).not.toBeNull();
    }
  });
});
