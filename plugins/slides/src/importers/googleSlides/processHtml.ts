const assetsPrefix = "/proxy-cache/gslide";
const fontCssPrefix = "/proxy-cache/gfonts-css";
const fontFilesPrefix = "/proxy-cache/gfonts";

const escape = (prefix: string) => prefix.replace(/\//g, "\\/");

// The viewer's versioned scripts and styles, absolute or relative. The
// lookbehind skips paths on other hosts, eg `ssl.gstatic.com/static/...`.
const ASSET_PATH =
  /(?:https:\/\/docs\.google\.com|(?<![\w.:]))\/(static\/presentation\/client|_\/presentations\/_)\//g;
// The same inside inline JSON, where slashes are escaped
const ASSET_PATH_ESCAPED =
  /(?:https:\\\/\\\/docs\.google\.com|(?<![\w.:]))\\\/(static\\\/presentation\\\/client|_\\\/presentations\\\/_)\\\//g;

/**
 * Points everything the embed needs to render at our own server, so it keeps
 * working offline. Other Google links are left as they are.
 * @param html - The raw HTML from Google
 * @param urlMapping - Mapping of original string (as in HTML) -> local media URL
 */
export function processHtml(
  html: string,
  urlMapping?: Map<string, string>,
): string {
  let processed = html
    // The viewer's scripts and styles, from the core proxy cache
    .replace(ASSET_PATH, `${assetsPrefix}/$1/`)
    .replace(ASSET_PATH_ESCAPED, `${escape(assetsPrefix)}\\/$1\\/`)
    // Google Fonts, from the core proxy cache
    .replace(/(https:)?\/\/fonts\.googleapis\.com\//g, `${fontCssPrefix}/`)
    .replace(/(https:)?\/\/fonts\.gstatic\.com\//g, `${fontFilesPrefix}/`)
    .replace(
      /(https:)?\\\/\\\/fonts\.googleapis\.com\\\//g,
      `${escape(fontCssPrefix)}\\/`,
    )
    .replace(
      /(https:)?\\\/\\\/fonts\.gstatic\.com\\\//g,
      `${escape(fontFilesPrefix)}\\/`,
    );

  // Slide images, already uploaded as media
  for (const [originalString, localUrl] of urlMapping ?? []) {
    processed = processed.split(originalString).join(localUrl);
  }

  return processed;
}
