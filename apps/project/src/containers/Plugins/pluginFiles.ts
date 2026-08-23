import { STARTER } from "./starterTemplate";

export const REQUIRED_FILES = ["remote.tsx", "renderer.tsx", "manifest.ts"];
const ALLOWED_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".css"];

export const isRequired = (name: string) => REQUIRED_FILES.includes(name);

/** Required files first, then the rest alphabetically. */
export const sortFiles = (names: string[]) =>
  [...names].sort((a, b) => {
    const ai = REQUIRED_FILES.indexOf(a);
    const bi = REQUIRED_FILES.indexOf(b);
    if (ai !== -1 || bi !== -1) {
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    }
    return a.localeCompare(b);
  });

export const validateFilename = (
  raw: string,
  existing: string[],
): string | null => {
  const name = raw.trim();
  if (!name) return "Enter a file name";
  if (existing.includes(name)) return `"${name}" already exists`;
  if (name.includes("/") || name.includes("\\"))
    return "Folders aren't supported";
  if (name.startsWith(".")) return "Name can't start with a dot";
  if (!/^[A-Za-z0-9._-]+$/.test(name))
    return "Use letters, numbers, dot, dash or underscore";
  if (!ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext)))
    return `Must end with ${ALLOWED_EXTENSIONS.join(", ")}`;
  return null;
};

// Backfill for older snapshots that doesn't have the required files
export const withRequiredFiles = (src: Record<string, string>) => {
  const out = { ...src };
  for (const name of REQUIRED_FILES) {
    if (out[name] === undefined) out[name] = STARTER[name] ?? "";
  }
  return out;
};

/** Best-effort extraction of the manifest object literal for the DB column. */
export const parseManifestSafe = (files: Record<string, string>) => {
  try {
    const body = files["manifest.ts"] ?? "";
    const match = body.match(/manifest\s*=\s*(\{[\s\S]*?\});/);
    if (!match) return {};
    // eslint-disable-next-line no-new-func
    return Function(`"use strict"; return (${match[1]});`)();
  } catch {
    return {};
  }
};

/** Highest built version, or null. Used as the base for a version bump. */
export const highestBuiltVersion = (
  versions: { version: string; buildStatus: string }[],
  builtStatus: string,
) => {
  const built = versions
    .filter((v) => v.buildStatus === builtStatus)
    .map((v) => v.version)
    .filter((v) => /^\d+\.\d+\.\d+$/.test(v));
  if (built.length === 0) return null;
  const rank = (v: string) => {
    const [a = 0, b = 0, c = 0] = v.split(".").map(Number);
    return a * 1_000_000 + b * 1_000 + c;
  };
  return built.sort((x, y) => rank(x) - rank(y))[built.length - 1] ?? null;
};
