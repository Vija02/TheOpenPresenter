import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";

import type { SharedModule } from "@repo/shared-modules";
import { VENDORED_MODULES } from "@repo/shared-modules";

/** Public URL prefix that `installSharedStatic` serves these files from. */
const PUBLIC_PREFIX = "/assets/shared";

/**
 * Records the hashed filename produced for a module and merges it into
 * `importmap.json`. Merges rather than overwrites: one module is built per
 * process.
 */
export const importmapPlugin = ({
  module: mod,
  outDir,
}: {
  module: SharedModule;
  outDir: string;
}): Plugin => ({
  name: "shared-runtime-importmap",
  apply: "build",
  writeBundle(_options, bundle) {
    const entry = Object.values(bundle).find(
      (chunk): chunk is typeof chunk & { isEntry: true } =>
        chunk.type === "chunk" && chunk.isEntry,
    );
    if (!entry) {
      throw new Error(`No entry chunk emitted for ${mod.specifier}`);
    }

    const manifestPath = join(outDir, "importmap.json");
    const manifest: { imports: Record<string, string> } = existsSync(
      manifestPath,
    )
      ? JSON.parse(readFileSync(manifestPath, "utf8"))
      : { imports: {} };

    manifest.imports = {
      ...manifest.imports,
      // Re-asserted on every write so the manifest stays self-contained.
      ...VENDORED_MODULES,
      [mod.specifier]: `${PUBLIC_PREFIX}/${entry.fileName}`,
    };

    const sorted = Object.fromEntries(
      Object.entries(manifest.imports).sort(([a], [b]) => a.localeCompare(b)),
    );

    writeFileSync(
      manifestPath,
      JSON.stringify({ imports: sorted }, null, 2) + "\n",
    );
  },
});
