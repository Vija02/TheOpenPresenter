import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import { createRequire } from "module";
import path from "path";

// Resolve from this module's own location
const RESOLVE_FROM =
  typeof __filename !== "undefined"
    ? __filename
    : path.join(process.cwd(), "index.js");

const TAILWIND_BASE = path.join(
  createRequire(RESOLVE_FROM).resolve("@repo/tailwind-config/package.json"),
  "..",
);

const INPUT_CSS = `@import "./index.css";`;

let compilerPromise: ReturnType<typeof compile> | undefined;

/** Class names found in the author's source, for Tailwind to generate */
export const scanCandidates = (source: Record<string, string>): string[] => {
  const scanner = new Scanner({});
  const candidates = new Set<string>();
  for (const [name, content] of Object.entries(source)) {
    const extension = name.split(".").pop() ?? "tsx";
    for (const candidate of scanner.getCandidatesWithPositions({
      content,
      extension,
    })) {
      candidates.add(candidate.candidate);
    }
  }
  return [...candidates];
};

export const buildPluginTailwind = async (
  source: Record<string, string>,
): Promise<string> => {
  const candidates = scanCandidates(source);
  if (candidates.length === 0) return "";

  // A compiler holds the parsed theme, which is the expensive part
  compilerPromise ??= compile(INPUT_CSS, {
    base: TAILWIND_BASE,
    onDependency: () => {},
  });

  try {
    const compiler = await compilerPromise;
    return compiler.build(candidates);
  } catch (e) {
    // Never reuse a compiler that threw; the next build gets a fresh one
    compilerPromise = undefined;
    throw e;
  }
};
