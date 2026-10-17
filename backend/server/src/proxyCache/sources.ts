/**
 * Whitelist of what we can proxy.
 */

export type ProxyCacheSource = {
  upstream: string;
  /** `pathAndQuery` is the request path after `/proxy-cache/<source>`. */
  isCacheable: (pathAndQuery: string) => boolean;
  /** Sent with the upstream request. */
  headers?: Record<string, string>;
  /** Applied once, before storing. */
  transform?: (body: Buffer, contentType: string) => Buffer;
  version?: number;
};

/** Points Google Fonts links in a stylesheet at the proxy cache. */
const rewriteGoogleFonts = (css: string) =>
  css
    .replace(/(https:)?\/\/fonts\.googleapis\.com\//g, "/proxy-cache/gfonts-css/")
    .replace(/(https:)?\/\/fonts\.gstatic\.com\//g, "/proxy-cache/gfonts/");

// Content-hashed viewer bundles, eg `/static/presentation/client/js/1234-viewer.js`
const GSLIDE_STATIC = /^\/static\/presentation\/client\/(js|css)\/[\w.-]+$/;
// The module loader, eg `/_/presentations/_/js/k=.../rs=<hash>/m=core`.
// Versioned by `rs=`; every segment after `k=` is `key=value`.
const GSLIDE_LOADER =
  /^\/_\/presentations\/_\/(js|ss)\/k=[^/?#]+(\/\w+=[^/?#]*)+$/;

// Versioned font files, eg `/s/roboto/v48/KFOMCnqEu92Fr1ME7kSn66aG.woff2`
const GFONTS_FILE = /^\/s\/[a-z0-9]+\/v\d+\/[\w-]+\.(woff2|woff|ttf|otf)$/;
// Stylesheets, eg `/css?family=Roboto%3A400`. Not versioned, but they only
// point at versioned files, so keeping the first copy forever is fine.
const GFONTS_CSS = /^\/css2?\?[\w%:;,@.+&=|-]+$/;

// Google picks the font format from the user agent. A current browser gets
// woff2, which every browser we support can load.
const MODERN_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

export const proxyCacheSources: Record<string, ProxyCacheSource> = {
  gslide: {
    upstream: "https://docs.google.com",
    isCacheable: (pathAndQuery) =>
      GSLIDE_STATIC.test(pathAndQuery) ||
      (GSLIDE_LOADER.test(pathAndQuery) && pathAndQuery.includes("/rs=")),
    transform: (body, contentType) =>
      contentType.startsWith("text/css")
        ? Buffer.from(rewriteGoogleFonts(body.toString("utf8")))
        : body,
    version: 2,
  },
  gfonts: {
    upstream: "https://fonts.gstatic.com",
    isCacheable: (pathAndQuery) => GFONTS_FILE.test(pathAndQuery),
  },
  "gfonts-css": {
    upstream: "https://fonts.googleapis.com",
    isCacheable: (pathAndQuery) => GFONTS_CSS.test(pathAndQuery),
    headers: { "user-agent": MODERN_USER_AGENT },
    transform: (body) => Buffer.from(rewriteGoogleFonts(body.toString("utf8"))),
  },
};
