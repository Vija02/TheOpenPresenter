import { RenderViewHandle } from "../../../Renderer/GoogleSlideRenderer/RenderView";
import { CaptureStep } from "./capturePlan";

/** Gap between key presses, so the embed handles each as its own press */
const PRESS_GAP_MS = 30;
/** No style changes for this long means the embed has finished animating */
const QUIET_MS = 120;
/** Give up waiting for a settle after this long */
const SETTLE_TIMEOUT_MS = 5000;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class CaptureCancelled extends Error {}

/** The slide the embed is showing: the SVG under the centre of its viewport. */
const showingSvg = (doc: Document): SVGSVGElement | null => {
  const win = doc.defaultView;
  if (!win) return null;
  const hit = doc.elementFromPoint(win.innerWidth / 2, win.innerHeight / 2);
  if (!hit) return null;
  return (
    Array.from(
      doc.querySelectorAll<SVGSVGElement>(
        ".punch-viewer-svgpage-svgcontainer svg",
      ),
    ).find((svg) => svg.contains(hit)) ?? null
  );
};

/** Resolves once the embed has made no style changes for `QUIET_MS`. */
const settled = (doc: Document, minMs: number, isCancelled: () => boolean) =>
  new Promise<void>((resolve, reject) => {
    const start = performance.now();
    let lastChange = start;
    const observer = new MutationObserver(() => {
      lastChange = performance.now();
    });
    observer.observe(doc.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });
    const check = () => {
      const now = performance.now();
      if (isCancelled()) {
        observer.disconnect();
        reject(new CaptureCancelled());
      } else if (
        (now - start >= minMs && now - lastChange >= QUIET_MS) ||
        now - start >= SETTLE_TIMEOUT_MS
      ) {
        observer.disconnect();
        resolve();
      } else {
        setTimeout(check, 15);
      }
    };
    check();
  });

let copyCount = 0;

/**
 * Copies are shown side by side in the page, so their ids must not collide:
 * every slide defines ids like `clipPath#p.0`.
 */
const scopeIds = (svg: SVGSVGElement) => {
  const prefix = `slide-capture-${++copyCount}-`;
  const renamed = new Map<string, string>();
  svg.querySelectorAll("[id]").forEach((element) => {
    renamed.set(element.id, prefix + element.id);
    element.id = prefix + element.id;
  });
  if (renamed.size === 0) return;

  const rewrite = (value: string) =>
    value
      .replace(/url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/g, (match, id) =>
        renamed.has(id) ? `url(#${renamed.get(id)})` : match,
      )
      .replace(/^#(.+)$/, (match, id) =>
        renamed.has(id) ? `#${renamed.get(id)}` : match,
      );

  [svg, ...Array.from(svg.querySelectorAll("*"))].forEach((element) => {
    for (const attr of Array.from(element.attributes)) {
      if (!attr.value.includes("#")) continue;
      const next = rewrite(attr.value);
      if (next !== attr.value) element.setAttribute(attr.name, next);
    }
  });
};

/**
 * A copy of the slide the embed shows, made safe to put in our page. Null if
 * the embed isn't showing `slideId`, so a wrong landing is never stored.
 */
const copySlide = (doc: Document, slideId: string): SVGSVGElement | null => {
  const source = showingSvg(doc);
  // The slide's own `<g>` isn't always drawn, but its `{slideId}.0` clip is
  const id = CSS.escape(slideId);
  if (!source?.querySelector(`[id="${id}"], [id^="${id}."]`)) return null;

  const copy = source.cloneNode(true) as SVGSVGElement;
  copy.removeAttribute("width");
  copy.removeAttribute("height");
  copy.setAttribute("preserveAspectRatio", "xMidYMid meet");
  copy.setAttribute("aria-hidden", "true");
  // The copy only needs to draw. Drop anything that could run.
  copy.querySelectorAll("script, foreignObject").forEach((el) => el.remove());
  [copy, ...Array.from(copy.querySelectorAll("*"))].forEach((element) => {
    for (const attr of Array.from(element.attributes)) {
      if (attr.name.toLowerCase().startsWith("on")) {
        element.removeAttribute(attr.name);
      }
    }
  });
  scopeIds(copy);
  return document.importNode(copy, true);
};

/**
 * Runs one slide's capture plan on the embed. Each `capture` step stores a
 * copy through `onCapture`; a position whose copy shows the wrong slide is
 * skipped rather than stored.
 */
export const runCapturePlan = async ({
  view,
  localSlideIndex,
  slideId,
  steps,
  onCapture,
  isCancelled,
}: {
  view: RenderViewHandle;
  localSlideIndex: number;
  slideId: string;
  steps: CaptureStep[];
  onCapture: (clickCount: number, svg: SVGSVGElement) => void;
  isCancelled: () => boolean;
}) => {
  const doc = () => {
    const d = view.getDocument();
    if (!d || isCancelled()) throw new CaptureCancelled();
    return d;
  };

  for (const step of steps) {
    switch (step.kind) {
      case "go":
        doc();
        view.goToSlide(localSlideIndex);
        break;
      case "next":
        doc();
        view.next();
        break;
      case "prev":
        doc();
        view.prev();
        break;
      case "snap":
        await wait(PRESS_GAP_MS);
        doc();
        view.next();
        await wait(PRESS_GAP_MS);
        doc();
        view.prev();
        break;
      case "settle":
        await settled(doc(), step.minMs, isCancelled);
        break;
      case "capture": {
        const copy = copySlide(doc(), slideId);
        if (copy) onCapture(step.clickCount, copy);
        break;
      }
    }
  }
};
