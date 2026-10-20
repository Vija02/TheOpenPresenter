import axios from "axios";
import { pino } from "pino";

import {
  USER_AGENT,
  bootstrapOfficeOnline,
  createCannotOpenTracker,
  officeServiceHeaders,
  safeJson,
  sleep,
} from "./officeOnline";

/**
 * Converts a PPT/PPTX into a PDF using the public Microsoft Office Online
 * viewer (the same WOPI flow the in-browser "Open PDF" button uses)
 *
 * Requirements & caveats:
 * - `publicPptUrl` MUST be reachable from the public internet
 *
 * The flow:
 *   1. GET  embed.aspx?src=<publicPptUrl>     -> assigned cluster host + WOPISrc
 *   2. POST .../jsonAnonymous/Print  (poll)    -> PrintUrl query
 *      (Error Code 59 / {webappfull} just means "not rendered yet" -> retry
 *   3. GET  /p/pdfhandler.ashx?<query> (poll)  -> PDF bytes
 */

interface ConvertOptions {
  printAttempts?: number;
  pdfAttempts?: number;
  pollIntervalMs?: number;
  requestTimeoutMs?: number;
}

export async function convertPptToPdfViaOfficeOnline(
  publicPptUrl: string,
  log: pino.Logger,
  opts: ConvertOptions = {},
): Promise<Buffer> {
  const printAttempts = opts.printAttempts ?? 30;
  const pdfAttempts = opts.pdfAttempts ?? 30;
  const pollIntervalMs = opts.pollIntervalMs ?? 2000;
  const timeout = opts.requestTimeoutMs ?? 60000;

  // 1) Bootstrap: resolve the assigned cluster host + WOPISrc from the loader
  const { host, presentationId } = await bootstrapOfficeOnline(
    publicPptUrl,
    timeout,
  );
  log.trace({ host }, "Office Online: cluster assigned");

  // 2) Print: poll until the render is ready (Code 59 == not ready yet).
  const printEndpoint = `https://${host}/p/ppt/view.https.svc/jsonAnonymous/Print`;

  let pdfQuery: string | undefined;
  const checkCannotOpen = createCannotOpenTracker();
  for (let attempt = 1; attempt <= printAttempts; attempt++) {
    const printRes = await axios.post(
      printEndpoint,
      JSON.stringify({ presentationId, useNamedAction: false }),
      {
        headers: officeServiceHeaders(host),
        responseType: "json",
        timeout,
        validateStatus: () => true,
      },
    );

    const data =
      typeof printRes.data === "string"
        ? safeJson(printRes.data)
        : printRes.data;
    const printUrl: string | undefined = data?.Result?.PrintUrl;
    if (printUrl) {
      pdfQuery = printUrl.replace(/\\\//g, "/").split("?")[1];
      break;
    }
    checkCannotOpen(data?.Error?.Code);
    log.trace(
      { attempt, printAttempts, errorCode: data?.Error?.Code },
      "Office Online: render not ready, polling Print",
    );
    await sleep(pollIntervalMs);
  }
  if (!pdfQuery) {
    throw new Error(
      `Office Online: Print never became ready after ${printAttempts} attempts`,
    );
  }

  // 3) Download the rendered PDF from the cluster-root pdfhandler.
  const pdfUrl = `https://${host}/p/pdfhandler.ashx?${pdfQuery}`;
  for (let attempt = 1; attempt <= pdfAttempts; attempt++) {
    const pdfRes = await axios.get(pdfUrl, {
      headers: { "User-Agent": USER_AGENT },
      responseType: "arraybuffer",
      timeout,
      validateStatus: () => true,
    });
    const buf = Buffer.from(pdfRes.data);
    if (buf.subarray(0, 4).toString("latin1") === "%PDF") {
      log.info({ bytes: buf.length }, "Office Online: PDF received");
      return buf;
    }
    log.trace(
      { attempt, pdfAttempts, status: pdfRes.status },
      "Office Online: PDF not ready, polling pdfhandler",
    );
    await sleep(pollIntervalMs);
  }
  throw new Error(
    `Office Online: PDF was not produced after ${pdfAttempts} attempts`,
  );
}
