/**
 * Reads the deck a pasted share link points at.
 *
 * Only the id is taken from a link; requests go to fixed hosts built from it,
 * so a pasted link can never make the server fetch an arbitrary URL.
 */

export class PublicLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicLinkError";
  }
}

const parseUrl = (input: string): URL | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    return new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
  } catch {
    return null;
  }
};

const isHost = (url: URL, host: string) =>
  url.hostname === host || url.hostname.endsWith(`.${host}`);

/**
 * The presentation id in a Google Slides link, e.g.
 * `https://docs.google.com/presentation/d/<id>/edit?usp=sharing`.
 */
export const parseGoogleSlidesLink = (input: string): string => {
  const url = parseUrl(input);
  if (!url || !isHost(url, "docs.google.com")) {
    throw new PublicLinkError("That isn't a Google Slides link.");
  }

  // "Publish to the web" links carry a different id that can't be exported
  // Workspace links carry the domain first: /a/<domain>/presentation/...
  const path = url.pathname.replace(/^\/a\/[^/]+(?=\/)/, "");

  if (/^\/presentation\/d\/e\//.test(path)) {
    throw new PublicLinkError(
      'That\'s a "Publish to the web" link. Use the link from the Share button instead.',
    );
  }

  const id = path.match(/^\/presentation\/(?:u\/\d+\/)?d\/([\w-]{20,})/)?.[1];
  if (!id) {
    throw new PublicLinkError("That isn't a Google Slides link.");
  }
  return id;
};

export type CanvaLink =
  | { kind: "design"; designId: string }
  | { kind: "short"; code: string };

/**
 * A Canva share link: `https://www.canva.com/design/<designId>/<token>/view`
 * (or `/edit`), or a `https://canva.link/<code>` short link.
 */
export const parseCanvaLink = (input: string): CanvaLink => {
  const url = parseUrl(input);

  if (url && url.hostname === "canva.link") {
    const code = url.pathname.match(/^\/([\w-]+)\/?$/)?.[1];
    if (code) return { kind: "short", code };
  }

  if (url && isHost(url, "canva.com")) {
    const designId = url.pathname.match(/^\/design\/([\w-]+)/)?.[1];
    if (designId) return { kind: "design", designId };
  }

  throw new PublicLinkError("That isn't a Canva design link.");
};

const CANVA_SHORT_LINK_TIMEOUT_MS = 10_000;
const CANVA_SHORT_LINK_MAX_HOPS = 5;

const isCanvaHost = (url: URL) =>
  url.hostname === "canva.link" || isHost(url, "canva.com");

/** Follows a `canva.link` short link to the design it points at. */
export const resolveCanvaShortLink = async (code: string): Promise<string> => {
  const notADesign = new PublicLinkError(
    "That Canva link doesn't lead to a design.",
  );
  let current = new URL(`https://canva.link/${encodeURIComponent(code)}`);

  for (let hop = 0; hop < CANVA_SHORT_LINK_MAX_HOPS; hop++) {
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(CANVA_SHORT_LINK_TIMEOUT_MS),
      });
    } catch {
      throw new PublicLinkError("Couldn't reach Canva. Try again in a moment.");
    }

    const location = res.headers.get("location");
    if (!location) throw notADesign;
    // Relative redirects resolve against where we are
    const next = new URL(location, current);
    // Only ever follow Canva's own hosts
    if (next.protocol !== "https:" || !isCanvaHost(next)) throw notADesign;

    const designId = next.pathname.match(/^\/design\/([\w-]+)/)?.[1];
    if (designId && isHost(next, "canva.com")) return designId;
    current = next;
  }
  throw notADesign;
};

/** The design id behind any Canva share link. */
export const canvaDesignIdFromLink = async (input: string) => {
  const link = parseCanvaLink(input);
  return link.kind === "design"
    ? link.designId
    : resolveCanvaShortLink(link.code);
};
