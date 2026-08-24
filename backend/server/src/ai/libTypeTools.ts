import { ALL_SHARED_SPECIFIERS } from "@repo/shared-modules";
import path from "path";

import { collectDeclarations, resolveTypesFile, truncate } from "./libTypes";

const RESOLVE_FROM =
  typeof __dirname !== "undefined" ? __dirname : process.cwd();

const IMPORTABLE = new Set(ALL_SHARED_SPECIFIERS);

export const listLibModules = () =>
  JSON.stringify([...IMPORTABLE].sort(), null, 1);

const notImportable = (specifier: string) =>
  `"${specifier}" is not importable by a client plugin. Available: ${[
    ...IMPORTABLE,
  ]
    .sort()
    .join(", ")}`;

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A file that only re-exports carries no declarations worth showing. */
const isBarrel = (text: string) => {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("//"));
  return (
    lines.length > 0 &&
    lines.every((line) => /^export\s+\*?.*from\s/.test(line))
  );
};

/** Full declarations for a module, following its re-export barrels. */
export const readLibTypes = (specifier: string): string => {
  if (!IMPORTABLE.has(specifier)) throw new Error(notImportable(specifier));

  const entry = resolveTypesFile(specifier, RESOLVE_FROM);
  if (!entry) {
    throw new Error(
      `No type declarations found for "${specifier}". It is importable, but ships no .d.ts.`,
    );
  }

  const parts = collectDeclarations(entry).map(
    ({ file, text }) => `// ${path.basename(file)}\n${text.trim()}`,
  );
  return truncate(parts.join("\n\n"));
};

export const findLibSymbol = (symbol: string, specifier?: string): string => {
  const targets = specifier ? [specifier] : [...IMPORTABLE];
  if (specifier && !IMPORTABLE.has(specifier)) {
    throw new Error(notImportable(specifier));
  }

  // A barrel mentions every symbol via its re-export paths, which is noise. Rank
  // files that actually DECLARE the symbol first, and drop pure barrels unless
  // nothing else matched.
  const declares = new RegExp(
    `\\b(?:declare\\s+)?(?:function|const|let|var|class|interface|type|enum)\\s+${escapeRegExp(symbol)}\\b`,
  );
  const mentions = new RegExp(`\\b${escapeRegExp(symbol)}\\b`);

  const strong: string[] = [];
  const weak: string[] = [];

  for (const target of targets) {
    const entry = resolveTypesFile(target, RESOLVE_FROM);
    if (!entry) continue;

    for (const { file, text } of collectDeclarations(entry)) {
      const body = text.trim();
      const header = `// ${target} -> ${path.basename(file)}`;
      if (declares.test(body)) {
        strong.push(`${header}\n${body}`);
      } else if (mentions.test(body) && !isBarrel(body)) {
        weak.push(`${header}\n${body}`);
      }
      if (strong.length >= 6) break;
    }
    if (strong.length >= 6) break;
  }

  const hits = strong.length > 0 ? strong : weak.slice(0, 4);
  if (hits.length === 0) {
    return `No declaration mentioning "${symbol}" found${
      specifier ? ` in ${specifier}` : ""
    }.`;
  }
  return truncate(hits.join("\n\n"));
};
