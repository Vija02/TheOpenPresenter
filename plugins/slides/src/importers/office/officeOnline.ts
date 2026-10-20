import axios from "axios";

/**
 * Shared plumbing for talking to the public PowerPoint for the web viewer
 * (view.officeapps.live.com). The file must be reachable from the internet.
 */

export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:151.0) Gecko/20100101 Firefox/151.0";
const EMBED_BASE = "https://view.officeapps.live.com/op/embed.aspx";

/** The service answers this while the file is still being rendered */
export const OFFICE_NOT_READY = 59;

/**
 * "We found a problem in your file". The service mixes it in with 59s while it
 * retries, so only give up after a few.
 */
export const OFFICE_CANNOT_OPEN = 256;
const CANNOT_OPEN_ATTEMPTS = 3;

export class OfficeCannotOpenError extends Error {
  constructor() {
    super(
      "We weren't able to open this file. It may be damaged or corrupted. Try opening it in PowerPoint and saving a new copy.",
    );
    this.name = "OfficeCannotOpenError";
  }
}

export const createCannotOpenTracker = () => {
  let count = 0;
  return (code: unknown) => {
    if (code !== OFFICE_CANNOT_OPEN) return;
    count += 1;
    if (count >= CANNOT_OPEN_ATTEMPTS) throw new OfficeCannotOpenError();
  };
};

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Decodes the JS `\uXXXX`-escaped string */
const decodeJsString = (s: string) =>
  s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
    String.fromCharCode(parseInt(h, 16)),
  );

export type OfficeSession = {
  /** The cluster host assigned to this file, e.g. `guk5-powerpoint.officeapps.live.com` */
  host: string;
  /** Identifies the file in every service call. No session or cookie needed */
  presentationId: string;
};

/** Resolves the assigned cluster host + WOPISrc from the embed loader */
export async function bootstrapOfficeOnline(
  publicPptUrl: string,
  timeout: number,
): Promise<OfficeSession> {
  const embedRes = await axios.get(EMBED_BASE, {
    params: { src: publicPptUrl },
    headers: { "User-Agent": USER_AGENT },
    responseType: "text",
    timeout,
  });
  const match = /var _iframeUrl = '([^']*)'/.exec(String(embedRes.data));
  if (!match || !match[1]) {
    throw new Error(
      "Office Online bootstrap failed: viewer returned no frame (is the file publicly reachable?)",
    );
  }
  const parsed = new URL(decodeJsString(match[1]));
  const wopiSrc = parsed.searchParams.get("WOPISrc");
  if (!wopiSrc) {
    throw new Error("Office Online bootstrap failed: no WOPISrc in frame URL");
  }
  return {
    host: parsed.host,
    presentationId:
      `WOPIsrc=${encodeURIComponent(wopiSrc)}` +
      `&access_token=1&access_token_ttl=0`,
  };
}

export const officeServiceHeaders = (host: string) => ({
  "User-Agent": USER_AGENT,
  "Content-Type": "application/json; charset=utf-8",
  Origin: `https://${host}`,
  "X-Requested-With": "XMLHttpRequest",
});

export function safeJson(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}
