import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

/** Settings and runtime files go here, never into the real install. */
export default function setup(): () => void {
  const root = mkdtempSync(join(tmpdir(), "top-studio-test-"));
  process.env.TOP_RUNTIME_ROOT = root;
  return () => rmSync(root, { recursive: true, force: true });
}
