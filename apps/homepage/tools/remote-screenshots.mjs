// Captures the two remote screenshots in the homepage hero from the real app,
// and measures where the hero's cursor clicks on them:
//
// - src/assets/images/home/hero-remote.png: the Lyrics tab, with the demo
//   songs on their motion backgrounds
// - src/assets/images/home/hero-remote-slides.png: the Slides tab, with the
//   thumbnails swapped for the hero's Genesis deck (DECK in sunday-scenes.py)
// - src/data/hero-remote.json: click targets as percentages of the images
//
// Needs the dev stack running (yarn dev, on ROOT_URL or localhost:5678) and
// Playwright in the root node_modules. It makes a fresh demo project with
// /init-demo, so it changes nothing you already have. Run from apps/homepage:
//
//     node tools/remote-screenshots.mjs
//
// Live borders are painted out (the hero draws its own) and the dev-only
// Debug section is removed. Selectors lean on visible text, since most of the
// app's class names are generated.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const homepage = resolve(here, "..");
const require = createRequire(resolve(homepage, "../../package.json"));
const { chromium } = require("playwright");

const base = process.env.ROOT_URL ?? "http://localhost:5678";
const VIEWPORT = { width: 1430, height: 700 }; // x2 = 2860x1400, plenty for the 1600px the hero serves
// lyric thumbnails the hero clicks, in order: [song, section label]
const LYRICS = [
  ["The Heart of Worship", "Verse 1"],
  ["The Heart of Worship", "Verse 1 (cont.)"],
  ["Build My Life", "Chorus"],
];

const deck = JSON.parse(
  execFileSync("python3", ["-B", resolve(here, "sunday-scenes.py"), "--deck-html"], { encoding: "utf8" }),
);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 2 });
await page.goto(`${base}/init-demo?template=lyrics-songs`, { waitUntil: "networkidle", timeout: 90_000 });
await page.waitForTimeout(3000);

// Leave the app as a church would see it
const tidy = () =>
  page.evaluate(() => {
    // the dev-only Debug section under the sidebar, gone as in production
    document.querySelectorAll(".rt--sidebar-web-debug-section").forEach((el) => (el.style.display = "none"));
    // the live slide's frame: same border as its neighbours
    const frames = [...document.querySelectorAll("div")].filter((el) => getComputedStyle(el).borderTopWidth === "4px");
    const colours = frames.map((el) => getComputedStyle(el).borderTopColor);
    const usual = colours.sort((a, b) => colours.filter((c) => c === b).length - colours.filter((c) => c === a).length)[0];
    frames.forEach((el) => (el.style.borderColor = usual));
  });

// Percentages of the viewport, which is the whole screenshot
const box = (r) => [r.x, r.y, r.width, r.height].map((v, i) => +((v / (i % 2 ? VIEWPORT.height : VIEWPORT.width)) * 100).toFixed(2));
const sidebarRow = (name) =>
  page.evaluate((name) => {
    const label = [...document.querySelectorAll("*")].find(
      (el) => el.childElementCount === 0 && el.textContent?.trim() === name && el.getBoundingClientRect().x < 100,
    );
    // up to the full-width row, but not the whole sidebar
    let row = label;
    while (row.parentElement && row.parentElement.getBoundingClientRect().height < 60) row = row.parentElement;
    const r = row.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, name);
// The frame under a slide's label: the card's second child
const frameUnder = (song, label) =>
  page.evaluate(
    ([song, label]) => {
      const all = [...document.querySelectorAll("*")].filter((el) => el.childElementCount === 0);
      const start = song ? all.findIndex((el) => el.textContent?.trim() === song) : 0;
      const tag = all.slice(start).find((el) => el.textContent?.trim().toLowerCase() === label.toLowerCase());
      const frame = tag.parentElement.nextElementSibling;
      const r = frame.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    },
    [song, label],
  );

// Lyrics tab
await tidy();
await page.waitForTimeout(500);
const lyrics = [];
for (const [song, label] of LYRICS) lyrics.push(box(await frameUnder(song, label)));
const tabs = { lyrics: box(await sidebarRow("Lyrics")), slides: box(await sidebarRow("Slides")) };
await page.screenshot({ path: resolve(homepage, "src/assets/images/home/hero-remote.png") });

// Slides tab, with the hero's deck in place of the demo's
await page.getByText("Slides", { exact: true }).first().click();
await page.waitForTimeout(2500);
await tidy();
const slides = await page.evaluate((deck) => {
  const tags = [...document.querySelectorAll("*")].filter(
    (el) => el.childElementCount === 0 && /^slide \d+$/i.test(el.textContent?.trim() ?? ""),
  );
  const out = [];
  tags.forEach((tag, i) => {
    const card = tag.parentElement.parentElement;
    if (i >= deck.length) return card.remove();
    const frame = tag.parentElement.nextElementSibling;
    const holder = frame.firstElementChild;
    holder.innerHTML = `<div style="position:relative;width:100%;height:100%">${deck[i]}</div>`;
    const r = frame.getBoundingClientRect();
    out.push({ x: r.x, y: r.y, width: r.width, height: r.height });
  });
  return out;
}, deck);
await page.waitForTimeout(500);
await page.screenshot({ path: resolve(homepage, "src/assets/images/home/hero-remote-slides.png") });
await browser.close();

const data = { lyrics, slides: slides.map(box), tabs };
writeFileSync(resolve(homepage, "src/data/hero-remote.json"), JSON.stringify(data, null, 2) + "\n");
console.log(JSON.stringify(data));
