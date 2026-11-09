#!/usr/bin/env node
// Fails when a change adds or modifies an image, video or audio file over the
// limit. Files already committed are left alone: git keeps every version, so
// shrinking them later only adds to the repo.
//
//     node scripts/check-media-size.mjs [--base <ref>] [--limit <KB>]
//
// --base defaults to HEAD, which checks uncommitted and untracked files.
// e2e/ is exempt: its snapshots are compared pixel for pixel.
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const base = arg("--base", "HEAD");
const LIMIT_KB = Number(arg("--limit", 400));
const MEDIA =
  /\.(png|jpe?g|gif|webp|avif|bmp|tiff?|mp4|webm|mov|mkv|m4v|mp3|wav|ogg|m4a|flac)$/i;
const EXEMPT = [/^e2e\//];

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8" }).split("\0").filter(Boolean);

const changed = new Set([
  ...git("diff", "--name-only", "--diff-filter=AMR", "-z", base),
  ...git("ls-files", "--others", "--exclude-standard", "-z"),
]);
const files = [...changed].filter(
  (f) => MEDIA.test(f) && !EXEMPT.some((re) => re.test(f)),
);

const tooBig = files
  .filter((f) => existsSync(f))
  .map((f) => ({ f, kb: statSync(f).size / 1024 }))
  .filter(({ kb }) => kb > LIMIT_KB)
  .sort((a, b) => b.kb - a.kb);

if (tooBig.length === 0) {
  console.log(
    `${files.length} new or changed media files since ${base}, all under ${LIMIT_KB} KB.`,
  );
  process.exit(0);
}

console.error(`New or changed media files over ${LIMIT_KB} KB:\n`);
for (const { f, kb } of tooBig)
  console.error(`  ${kb.toFixed(0).padStart(6)} KB  ${f}`);
console.error(`
Compress before committing, for example:
  PNG screenshot  ffmpeg -i in.png -c:v libwebp -quality 90 out.webp
  PNG (lossless)  optipng -o2 -strip all in.png
  JPEG            jpegoptim -m85 --strip-all in.jpg
  Video           ffmpeg -i in.mp4 -c:v libx264 -crf 28 -preset slow -an out.mp4
Astro's <Image> re-encodes for the site, so the source only needs to look right.`);
process.exit(1);
