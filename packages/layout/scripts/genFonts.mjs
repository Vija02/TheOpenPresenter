/**
 * Regenerates src/react/fonts.css from the installed @fontsource-variable
 * packages.
 *
 * Why generate rather than `@import` fontsource's own CSS: Vite's library mode
 * inlines every referenced asset unconditionally. `shouldInline` returns true
 * for `build.lib` before it ever consults `assetsInlineLimit`. So importing
 * their stylesheets embedded ~1MB of base64 woff2 into ours
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");
const OUT = resolve(HERE, "../src/react/fonts.css");

/** Must match the bundled entries in src/fonts/registry.ts. */
const FAMILIES = [
  "inter",
  "source-sans-3",
  "open-sans",
  "montserrat",
  "oswald",
  "playfair-display",
];

const HEADER = `/**
 * Bundled font faces for the layout renderer. GENERATED. Do not edit.
 *
 * Run \`yarn workspace @repo/layout gen:fonts\` to regenerate after changing the
 * bundled font list in src/fonts/registry.ts.
 *
 * Generated from \`@fontsource-variable/*\` rather than importing their
 * index.css, because Vite's library mode inlines every referenced asset
 * unconditionally: \`shouldInline\` returns true for \`build.lib\` before it
 * consults \`assetsInlineLimit\`. Importing their CSS therefore embedded ~1MB of
 * base64 woff2 here, and again in editor.css. \`?no-inline\` is checked above
 * that short-circuit, so it is what forces real, separately cacheable files.
 */
`;

const blocks = [HEADER];
let faces = 0;

for (const family of FAMILIES) {
  const css = readFileSync(
    resolve(ROOT, `node_modules/@fontsource-variable/${family}/index.css`),
    "utf8",
  );
  // Only the url() changes: unicode-range, weight axis and ordering stay as
  // upstream ships them.
  const rewritten = css.replace(
    /url\(\.\/files\/([^)]+)\)/g,
    (_m, file) =>
      `url("@fontsource-variable/${family}/files/${file}?no-inline")`,
  );
  faces += (rewritten.match(/@font-face/g) ?? []).length;
  blocks.push(rewritten.trim() + "\n");
}

const prettier = await import("prettier");
const options = (await prettier.resolveConfig(OUT)) ?? {};
const formatted = await prettier.format(blocks.join("\n"), {
  ...options,
  filepath: OUT,
});

writeFileSync(OUT, formatted);
console.log(`fonts.css: ${faces} faces across ${FAMILIES.length} families`);
