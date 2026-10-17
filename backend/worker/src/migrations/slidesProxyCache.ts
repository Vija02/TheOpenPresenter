import type { YState } from "@repo/base-plugin";
import * as Y from "yjs";

/**
 * Moves Google Slides imports onto the proxy cache, matching what the slides
 * importer now stores:
 * - the viewer's scripts and styles, which went through the plugin's
 *   `gslide/gscripts` proxy (sometimes with the prefix doubled up)
 * - Google Fonts, which were loaded straight from Google
 * - other Google links, which went through `gscripts` too. That route is
 *   gone, so they go back to being plain Google links
 *
 * A frozen copy rather than an import of the plugin's `processHtml`, so this
 * keeps doing the same thing if the importer changes again.
 */

const PLUGIN_NAME = "slides";

const ASSETS_PREFIX = "/proxy-cache/gslide";
const FONT_CSS_PREFIX = "/proxy-cache/gfonts-css";
const FONT_FILES_PREFIX = "/proxy-cache/gfonts";

const escape = (prefix: string) => prefix.replace(/\//g, "\\/");

// One or more `gscripts` prefixes, the old absolute host, or a bare relative
// path. The lookbehind skips the same paths on other hosts.
const ASSET_PATH =
  /(?:(?:\/plugin\/slides\/gslide\/gscripts)+|https:\/\/docs\.google\.com|(?<![\w.:]))\/(static\/presentation\/client|_\/presentations\/_)\//g;
const ASSET_PATH_ESCAPED =
  /(?:(?:\\\/plugin\\\/slides\\\/gslide\\\/gscripts)+|https:\\\/\\\/docs\.google\.com|(?<![\w.:]))\\\/(static\\\/presentation\\\/client|_\\\/presentations\\\/_)\\\//g;

/** The upgraded html, or null when there's nothing to change. */
export const rewriteSlidesHtml = (html: string): string | null => {
  const next = html
    .replace(ASSET_PATH, `${ASSETS_PREFIX}/$1/`)
    .replace(ASSET_PATH_ESCAPED, `${escape(ASSETS_PREFIX)}\\/$1\\/`)
    .replace(/(?:\/plugin\/slides\/gslide\/gscripts)+/g, "https://docs.google.com")
    .replace(
      /(?:\\\/plugin\\\/slides\\\/gslide\\\/gscripts)+/g,
      "https:\\/\\/docs.google.com",
    )
    .replace(/(https:)?\/\/fonts\.googleapis\.com\//g, `${FONT_CSS_PREFIX}/`)
    .replace(/(https:)?\/\/fonts\.gstatic\.com\//g, `${FONT_FILES_PREFIX}/`)
    .replace(
      /(https:)?\\\/\\\/fonts\.googleapis\.com\\\//g,
      `${escape(FONT_CSS_PREFIX)}\\/`,
    )
    .replace(
      /(https:)?\\\/\\\/fonts\.gstatic\.com\\\//g,
      `${escape(FONT_FILES_PREFIX)}\\/`,
    );

  return next === html ? null : next;
};

/** Every Google Slides import across the project's scenes. */
export const googleSlidesImports = (ydoc: Y.Doc): Y.Map<any>[] => {
  const state = ydoc.getMap() as YState;
  const dataMap = state.get("data") as Y.Map<any> | undefined;
  const found: Y.Map<any>[] = [];

  for (const sceneValue of dataMap?.values() ?? []) {
    if (!(sceneValue instanceof Y.Map)) continue;
    if (sceneValue.get("type") !== "scene") continue;

    const children = sceneValue.get("children") as Y.Map<any> | undefined;
    for (const pluginValue of children?.values() ?? []) {
      if (!(pluginValue instanceof Y.Map)) continue;
      if (pluginValue.get("plugin") !== PLUGIN_NAME) continue;

      const imports = pluginValue.get("pluginData")?.get("imports");
      if (!(imports instanceof Y.Map)) continue;

      for (const entry of imports.values()) {
        if (!(entry instanceof Y.Map)) continue;
        if (entry.get("type") !== "googleslides") continue;
        found.push(entry);
      }
    }
  }
  return found;
};

/** Upgrades every import in place. Whether anything changed. */
export const upgradeSlidesDocument = (ydoc: Y.Doc): boolean => {
  let mutated = false;
  ydoc.transact(() => {
    for (const entry of googleSlidesImports(ydoc)) {
      const html = entry.get("html");
      if (typeof html !== "string") continue;
      const rewritten = rewriteSlidesHtml(html);
      if (rewritten === null) continue;
      entry.set("html", rewritten);
      mutated = true;
    }
  });
  return mutated;
};
