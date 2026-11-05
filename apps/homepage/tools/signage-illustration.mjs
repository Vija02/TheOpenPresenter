// Generates draft illustrations for the "volunteers run it from their phone"
// section (SignageControl.astro) with a Gemini image model: a TV and a tablet
// held from the bottom right, on plain white. The TV screen and the tablet's
// thumbnails are solid placeholder colours that signage-compose.py swaps for
// the real frames.
//
//   node tools/signage-illustration.mjs --list-models
//   node tools/signage-illustration.mjs --scene kids --count 2 --out /tmp/signage
//
// Reads GEMINI_API_KEY from the environment or apps/homepage/.env.local.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    scene: { type: "string", default: "kids" },
    count: { type: "string", default: "2" },
    aspect: { type: "string", default: "3:4" },
    model: { type: "string", default: "gemini-3-pro-image" },
    out: { type: "string", default: join(tmpdir(), "signage-illustration") },
    "list-models": { type: "boolean", default: false },
  },
});

function apiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (existsSync(".env.local")) {
    const m = readFileSync(".env.local", "utf8").match(/^GEMINI_API_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("Set GEMINI_API_KEY, or add it to apps/homepage/.env.local");
}

const API = "https://generativelanguage.googleapis.com/v1beta";
const headers = { "x-goog-api-key": apiKey(), "content-type": "application/json" };

if (args["list-models"]) {
  const res = await fetch(`${API}/models?pageSize=1000`, { headers });
  const { models = [] } = await res.json();
  for (const m of models.filter((m) => /image/i.test(m.name)))
    console.log(m.name.replace("models/", ""), "-", m.displayName);
  process.exit(0);
}

const STYLE =
  "Clean flat vector illustration: crisp, perfectly straight lines and " +
  "geometric shapes, consistent thin dark outlines, no hand-drawn wobble, " +
  "no texture or grain, subtle flat shading. Muted warm palette (cream, " +
  "sand, teal, ochre, terracotta).";

// Single devices for the "runs on" section (SignageDevices.astro)
const DEVICES = {
  firestick:
    "a small black streaming stick that plugs straight into an HDMI port, " +
    "with its slim black voice remote beside it",
  googletv:
    "a small rounded, pebble-shaped white streaming dongle on a short HDMI " +
    "cable, with its small white remote beside it",
  raspberrypi:
    "a credit-card-sized single-board computer: a green circuit board with " +
    "a row of USB and ethernet ports along one edge, a small processor chip " +
    "and a pin header along the other edge",
  minipc:
    "a small, square, low-profile mini PC: a dark grey box about the size " +
    "of a hand, with a power button and two USB ports on the front",
  laptop:
    "an open modern laptop, slightly turned, silver body. Its screen is " +
    "filled edge to edge with solid flat magenta (#FF00FF), a placeholder " +
    "to be replaced later, with no reflections",
};

// A chroma-key backdrop cuts out far cleaner than an off-white studio sweep.
// Magenta, since the Pi is green; the laptop's screen is already magenta.
const KEY = "solid flat magenta (#FF00FF) chroma-key";
const BACKDROP = { googletv: KEY, raspberrypi: KEY, minipc: KEY };

function devicePrompt(desc, backdrop = "pure white (#FFFFFF)") {
  return [
    "Photorealistic studio product photograph, as in a premium electronics " +
      "catalogue: soft, even lighting, crisp focus, true-to-life materials.",
    `A single object, centred, on a seamless, evenly lit ` +
      `${backdrop} background: ${desc}. Three-quarter view from slightly above.`,
    "Nothing else at all: no table, cables running off, reflections on the " +
      "floor, cast or contact shadows, logos, brand names or text anywhere. " +
      "The background is perfectly uniform, with no gradient or vignette.",
    "Square composition with generous white space around the object.",
  ].join("\n\n");
}

const ROOMS = { kids: "Kids 3–5", lobby: "Lobby" };
const room = ROOMS[args.scene];
if (!room && !DEVICES[args.scene])
  throw new Error(
    `--scene must be one of ${[...Object.keys(ROOMS), ...Object.keys(DEVICES)]}`,
  );

const tabletPrompt = () => [
  STYLE,
  "Exactly two objects on a plain, flat, pure white background (#FFFFFF). " +
    "Nothing else at all: no room, wall, floor, furniture, plants, people, " +
    "cast shadows or texture on the background.",
  "1. A modern flat-screen TV, seen straight on, slim charcoal bezel, on a " +
    "short wall bracket, in the upper part of the picture. Its screen is filled edge to edge " +
    "with solid flat magenta (#FF00FF).",
  "2. Below the TV and overlapping its bottom edge, a modern tablet in landscape " +
    "orientation, seen straight on, slim dark bezel. Only a small part of one " +
    "adult hand shows, holding the tablet's bottom-right corner from below " +
    "(thumb resting on the bezel, not on the screen); the wrist runs off the " +
    "bottom-right edge of the picture. The tablet screen: a dark header bar " +
    `with the text "${room}" on the left, then a grid of six 16:9 thumbnail ` +
    "slots (two rows of three) on white, separated by white gaps, each filled " +
    "with solid flat cyan (#00FFFF). The top-middle slot has a thick red " +
    "border.",
  "The magenta and cyan areas are placeholders that will be replaced " +
    "later: keep them perfectly flat, sharp-edged rectangles with no " +
    "gradients, reflections or texture, and don't draw anything over them.",
  "Portrait (tall) composition: the TV on top, the tablet below it, stacked " +
    "vertically and not spread out sideways. Generous white space around the " +
    "objects.",
].join("\n\n");

// Lobby: the point is that anyone can update it from whatever they carry
const phoneAndTabletPrompt = () => [
  STYLE,
  "Exactly three objects on a plain, flat, pure white background (#FFFFFF). " +
    "Nothing else at all: no room, floor, furniture, plants, people, cast " +
    "shadows or texture on the background.",
  "1. A large modern flat-screen TV mounted high on a wall, seen straight " +
    "on, slim charcoal bezel. Show only a short section of plain wall behind " +
    "it (a soft cream rectangle slightly larger than the TV) and the wall " +
    "bracket, so it reads as wall-mounted. Its screen is filled edge to edge " +
    "with solid flat magenta (#FF00FF).",
  "2. Below the TV on the left, one adult hand holds a smartphone upright, " +
    "facing the viewer straight on, natural grip, wrist running off the " +
    "bottom edge. The phone screen: a dark header bar, then three stacked " +
    "16:9 thumbnail slots on white, each solid flat cyan (#00FFFF); the " +
    "middle slot has a thick red border.",
  "3. Below the TV on the right, a different adult hand holds a tablet in " +
    "landscape orientation from its bottom-right corner, facing the viewer " +
    "straight on, thumb on the bezel, wrist running off the bottom-right " +
    "edge. The tablet screen: a dark header bar with the text " +
    `"${room}", then a grid of six 16:9 thumbnail slots (two rows of three) ` +
    "on white, each solid flat cyan (#00FFFF); the top-middle slot has a " +
    "thick red border.",
  "The phone and tablet don't overlap each other. The magenta and cyan " +
    "areas are placeholders that will be replaced later: keep them perfectly " +
    "flat, sharp-edged rectangles with no gradients, reflections or texture, " +
    "and don't draw anything over them.",
  "Portrait (tall) composition: the TV on top, the phone and tablet below.",
].join("\n\n");

const prompt = !room
  ? devicePrompt(DEVICES[args.scene], BACKDROP[args.scene])
  : args.scene === "lobby"
    ? phoneAndTabletPrompt()
    : tabletPrompt();
const aspect = room ? args.aspect : "1:1";

mkdirSync(args.out, { recursive: true });
for (let i = 0; i < Number(args.count); i++) {
  const res = await fetch(`${API}/models/${args.model}:generateContent`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: aspect },
      },
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json.error ?? json));
  const img = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!img) {
    console.error("No image returned:", JSON.stringify(json).slice(0, 500));
    continue;
  }
  const ext = img.inlineData.mimeType.split("/")[1] ?? "png";
  const file = join(args.out, `${args.scene}-${Date.now()}-${i + 1}.${ext}`);
  writeFileSync(file, Buffer.from(img.inlineData.data, "base64"));
  console.log(file);
}
