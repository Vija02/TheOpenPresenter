import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Checks that every shared bundle is actually resolvable in the browser.
// The failures caught here are silent and runtime-only; see README.md.

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../../backend/server/public/assets/shared");
const PUBLIC_ROOT = resolve(__dirname, "../../backend/server/public");

const manifest = JSON.parse(
  readFileSync(join(OUT_DIR, "importmap.json"), "utf8"),
);
const imports = manifest.imports;

const files = readdirSync(OUT_DIR).filter((f) => f.endsWith(".mjs"));
const problems = [];

// Declared named exports, per module. Parsed rather than imported because this
// runs under plain node with no TypeScript loader.
const MODULE_SOURCE = readFileSync(
  resolve(__dirname, "../shared-modules/src/index.ts"),
  "utf8",
);
const declaredNamedExports = [
  ...MODULE_SOURCE.matchAll(
    /specifier:\s*"([^"]+)",([\s\S]*?)\n  \}/g,
  ),
]
  .map(([, specifier, body]) => {
    const named = body.match(/namedExports:\s*\[([^\]]*)\]/);
    const aliases = body.match(/exportAliases:\s*\{([^}]*)\}/);
    return {
      specifier,
      names: [
        ...(named ? [...named[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : []),
        ...(aliases
          ? [...aliases[1].matchAll(/(\w+)\s*:/g)].map((m) => m[1])
          : []),
      ],
    };
  })
  .filter((m) => m.names.length > 0);

// 1. Every bare specifier in every bundle must have an import map entry.
//    Import maps do NOT resolve subpaths from a parent entry.
for (const file of files) {
  const source = readFileSync(join(OUT_DIR, file), "utf8");
  const specifiers = new Set();

  // Anchored to statement start so a `from "..."` inside a string literal
  // (Tailwind class metadata in @repo/ui) is not mistaken for a real import.
  const STATIC_IMPORT =
    /(?:^|[;}\n])\s*(?:import|export)\b[^;'"]*?\bfrom\s*"([^"]+)"/g;
  for (const m of source.matchAll(STATIC_IMPORT)) {
    specifiers.add(m[1]);
  }
  // Bare side-effect imports: import "x";
  for (const m of source.matchAll(/(?:^|[;}\n])\s*import\s*"([^"]+)"/g)) {
    specifiers.add(m[1]);
  }
  // Static dynamic imports. Template literals cannot be checked here.
  for (const m of source.matchAll(/\bimport\s*\(\s*"([^"]+)"\s*\)/g)) {
    specifiers.add(m[1]);
  }

  for (const spec of specifiers) {
    if (spec.startsWith("./") || spec.startsWith("../")) continue;
    if (spec.startsWith("/")) continue;
    if (!(spec in imports)) {
      problems.push(`${file}: unmapped bare specifier "${spec}"`);
    }
  }
}

// 2. Every import map target must exist on disk.
for (const [spec, url] of Object.entries(imports)) {
  const path = join(PUBLIC_ROOT, url.replace(/^\/assets\//, "assets/"));
  try {
    readFileSync(path);
  } catch {
    problems.push(`"${spec}" -> ${url} does not exist on disk`);
  }
}

// 3. Server-only code must never reach a browser bundle.
const SERVER_ONLY = ["@hocuspocus/server", "@trpc/server", "node:fs", "node:path"];
for (const file of files) {
  const source = readFileSync(join(OUT_DIR, file), "utf8");
  for (const marker of SERVER_ONLY) {
    if (source.includes(`"${marker}"`)) {
      problems.push(`${file}: contains server-only import "${marker}"`);
    }
  }
}

/**
 * Imports a built bundle the way the browser resolves it: mapped specifiers are
 * rewritten to their import map targets and loaded as a data URL, so node
 * cannot resolve bare "react" to node_modules. See README.md.
 */
const importAsBrowserWould = (path) => {
  const rewritten = readFileSync(path, "utf8").replace(
    /(from\s*)"([^"]+)"/g,
    (whole, from, spec) => {
      const url = imports[spec];
      if (!url) return whole;
      const target = join(PUBLIC_ROOT, url.replace(/^\/assets\//, "assets/"));
      return `${from}${JSON.stringify(pathToFileURL(target).href)}`;
    },
  );
  return import(
    "data:text/javascript;base64," +
      Buffer.from(rewritten, "utf8").toString("base64")
  );
};

// Production React has no `getOwner`, so a bundle expecting the development
// internals cannot work against it.
const vendoredReactIsProduction = !readFileSync(
  join(PUBLIC_ROOT, imports["react"].replace(/^\/assets\//, "assets/")),
  "utf8",
).includes("getOwner");

// 4. A declared named export must not be bound to undefined. React's
//    production jsx-dev-runtime stub exports `jsxDEV: undefined` rather than
//    failing, so every check above passes and the app dies on first render.
if (declaredNamedExports.length === 0) {
  problems.push("could not parse any namedExports from @repo/shared-modules");
}
for (const { specifier, names } of declaredNamedExports) {
  const safeName = specifier.replace(/^@/, "").replace(/[/]/g, "__");
  const file = files.find((f) => f.startsWith(safeName + "-"));
  if (!file) {
    problems.push(`${specifier}: no built bundle found`);
    continue;
  }

  const ns = await importAsBrowserWould(join(OUT_DIR, file)).catch((e) => {
    problems.push(`${file}: failed to import (${e.message})`);
    return null;
  });
  if (!ns) continue;

  for (const name of names) {
    if (ns[name] === undefined) {
      problems.push(
        `${file}: export "${name}" of ${specifier} is undefined ` +
          `(a production stub?)`,
      );
    }
  }
}

// 5. The JSX runtimes must actually WORK against the vendored React. Being
//    defined is not enough: a development JSX runtime calls
//    `internals.getOwner()`, which the production vendored React lacks.
for (const [spec, exportName] of [
  ["react/jsx-runtime", "jsx"],
  ["react/jsx-dev-runtime", "jsxDEV"],
]) {
  const url = imports[spec];
  if (!url) continue;
  const path = join(PUBLIC_ROOT, url.replace(/^\/assets\//, "assets/"));

  try {
    const source = readFileSync(path, "utf8");

    // Static, because a live call always takes the dev runtime's null-owner
    // branch under node and passes even when the browser fails. See README.md.
    if (vendoredReactIsProduction) {
      for (const devOnly of ["getOwner", "react-stack-top-frame"]) {
        if (source.includes(devOnly)) {
          problems.push(
            `${spec}: references dev-only React internal "${devOnly}", but the ` +
              `vendored React is a production build (no such internal). This ` +
              `throws "getOwner is not a function" on the first render.`,
          );
        }
      }
    }

    const ns = await importAsBrowserWould(path);
    if (typeof ns[exportName] !== "function") {
      problems.push(`${spec}: ${exportName} is not a function`);
    }
  } catch (e) {
    problems.push(
      `${spec}: ${exportName}() throws against the vendored React (${e.message})`,
    );
  }
}

if (problems.length > 0) {
  console.error(`FAILED (${problems.length} problem(s)):\n`);
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}

console.log(
  `OK: ${files.length} bundles, ${Object.keys(imports).length} import map entries, all specifiers resolvable.`,
);
