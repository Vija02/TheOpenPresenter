import axios from "axios";

/**
 * Converts a PPT/PPTX into a PDF using the public Microsoft Office Online
 * viewer (the same WOPI flow the in-browser "Open PDF" button uses).
 *
 * Requirements & caveats:
 * - `publicPptUrl` MUST be reachable from the public internet, because
 *   Microsoft's anonymous WOPI host fetches the file itself. This makes the
 *   feature cloud-only; a self-hosted instance behind NAT cannot use it.
 * - This relies on an undocumented internal endpoint of the free Office web
 *   viewer. It can change without notice; failures are surfaced loudly.
 *
 * The flow (no auth, no `z`/`X-Key` needed):
 *   1. GET  embed.aspx?src=<publicPptUrl>           -> cluster host + WOPISrc
 *   2. POST PowerPointFrame.aspx (cookie jar)        -> warms session (BIGipCookie)
 *   3. POST .../jsonAnonymous/Print  (poll)          -> PrintUrl query
 *      (Error Code 59 / {webappfull} just means "not rendered yet" -> retry,
 *       exactly like the web app polls the button.)
 *   4. GET  /p/pdfhandler.ashx?<query> (poll)        -> PDF bytes
 */

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:151.0) Gecko/20100101 Firefox/151.0";
const EMBED_BASE = "https://view.officeapps.live.com/op/embed.aspx";

interface ConvertLogger {
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
}

interface ConvertOptions {
  /** Attempts for the Print step (it returns Code 59 until the render is ready). */
  printAttempts?: number;
  /** Attempts for the pdfhandler download. */
  pdfAttempts?: number;
  /** Delay between attempts, ms. */
  pollIntervalMs?: number;
  /** Per-request timeout, ms. */
  requestTimeoutMs?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Decodes the JS `\uXXXX`-escaped string Microsoft inlines as `_iframeUrl`. */
const decodeJsString = (s: string) =>
  s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
    String.fromCharCode(parseInt(h, 16)),
  );

class CookieJar {
  private jar = new Map<string, string>();
  capture(setCookie: unknown) {
    if (!Array.isArray(setCookie)) return;
    for (const c of setCookie) {
      const pair = String(c).split(";")[0];
      const eq = pair.indexOf("=");
      if (eq > 0) this.jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  header(): string | undefined {
    if (this.jar.size === 0) return undefined;
    return Array.from(this.jar.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }
}

export async function convertPptToPdfViaOfficeOnline(
  publicPptUrl: string,
  log: ConvertLogger,
  opts: ConvertOptions = {},
): Promise<Buffer> {
  const printAttempts = opts.printAttempts ?? 30;
  const pdfAttempts = opts.pdfAttempts ?? 30;
  const pollIntervalMs = opts.pollIntervalMs ?? 2000;
  const timeout = opts.requestTimeoutMs ?? 60000;

  // 1) Bootstrap: resolve the assigned cluster host + WOPISrc from the loader.
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
  const iframeUrl = decodeJsString(match[1]);
  const parsed = new URL(iframeUrl);
  const host = parsed.host;
  const wopiSrc = parsed.searchParams.get("WOPISrc");
  if (!wopiSrc) {
    throw new Error("Office Online bootstrap failed: no WOPISrc in frame URL");
  }
  log.info({ host }, "Office Online: cluster assigned");

  const jar = new CookieJar();

  // 2) Warm the frame so the doc session + load-balancer cookie are established.
  const frameRes = await axios.post(
    iframeUrl,
    "access_token=1&access_token_ttl=0",
    {
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: "https://view.officeapps.live.com/",
      },
      responseType: "text",
      timeout,
      validateStatus: () => true,
    },
  );
  jar.capture(frameRes.headers["set-cookie"]);

  // 3) Print: poll until the render is ready (Code 59 == not ready yet).
  const printEndpoint = `https://${host}/p/ppt/view.https.svc/jsonAnonymous/Print`;
  const presentationId =
    `WOPIsrc=${encodeURIComponent(wopiSrc)}` +
    `&access_token=1&access_token_ttl=0`;

  let pdfQuery: string | undefined;
  for (let attempt = 1; attempt <= printAttempts; attempt++) {
    const printRes = await axios.post(
      printEndpoint,
      JSON.stringify({ presentationId, useNamedAction: false }),
      {
        headers: {
          "User-Agent": USER_AGENT,
          "Content-Type": "application/json; charset=utf-8",
          Origin: `https://${host}`,
          Referer: iframeUrl,
          "X-Requested-With": "XMLHttpRequest",
          ...(jar.header() ? { Cookie: jar.header()! } : {}),
        },
        responseType: "json",
        timeout,
        validateStatus: () => true,
      },
    );
    jar.capture(printRes.headers["set-cookie"]);

    const data =
      typeof printRes.data === "string"
        ? safeJson(printRes.data)
        : printRes.data;
    const printUrl: string | undefined = data?.Result?.PrintUrl;
    if (printUrl) {
      pdfQuery = printUrl.replace(/\\\//g, "/").split("?")[1];
      break;
    }
    const code = data?.Error?.Code;
    log.info(
      { attempt, printAttempts, errorCode: code },
      "Office Online: render not ready, polling Print",
    );
    await sleep(pollIntervalMs);
  }
  if (!pdfQuery) {
    throw new Error(
      `Office Online: Print never became ready after ${printAttempts} attempts`,
    );
  }

  // 4) Download the rendered PDF from the cluster-root pdfhandler.
  const pdfUrl = `https://${host}/p/pdfhandler.ashx?${pdfQuery}`;
  for (let attempt = 1; attempt <= pdfAttempts; attempt++) {
    const pdfRes = await axios.get(pdfUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Referer: iframeUrl,
        ...(jar.header() ? { Cookie: jar.header()! } : {}),
      },
      responseType: "arraybuffer",
      timeout,
      validateStatus: () => true,
    });
    const buf = Buffer.from(pdfRes.data);
    if (buf.subarray(0, 4).toString("latin1") === "%PDF") {
      log.info({ bytes: buf.length }, "Office Online: PDF received");
      return buf;
    }
    log.info(
      { attempt, pdfAttempts, status: pdfRes.status },
      "Office Online: PDF not ready, polling pdfhandler",
    );
    await sleep(pollIntervalMs);
  }
  throw new Error(
    `Office Online: PDF was not produced after ${pdfAttempts} attempts`,
  );
}

function safeJson(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}
