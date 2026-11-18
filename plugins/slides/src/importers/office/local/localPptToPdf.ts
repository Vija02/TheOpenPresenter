import type { pino } from "pino";

import { isOnline } from "../network";
import {
  convertPptToPdfLocally,
  isLocalPowerPointAvailable,
} from "./convertPptToPdfLocally";

type Converted<T> = T & { pdfBuffer: Buffer; source: "local" | "online" };

/**
 * Office Online when online (it also captures animations), else this
 * computer's PowerPoint. Local is also the fallback when Office Online fails.
 */
export const convertPptWithFallback = async <T extends { pdfBuffer: Buffer }>(
  {
    readPptx,
    extension,
    viaOfficeOnline,
    localExtras,
  }: {
    readPptx: () => Promise<Buffer>;
    extension: string;
    viaOfficeOnline: () => Promise<T>;
    localExtras: Omit<T, "pdfBuffer">;
  },
  log: pino.Logger,
): Promise<Converted<T>> => {
  const online = async () => ({
    ...(await viaOfficeOnline()),
    source: "online" as const,
  });
  if (!(await isLocalPowerPointAvailable())) return online();

  if (await isOnline()) {
    try {
      return await online();
    } catch (err) {
      log.warn({ err }, "Office Online failed, using the local PowerPoint");
    }
  }

  log.info("Converting PPT to PDF with the local PowerPoint...");
  const pdfBuffer = await convertPptToPdfLocally(await readPptx(), log, {
    extension,
  });
  return { ...localExtras, pdfBuffer, source: "local" } as Converted<T>;
};

export const offlineUnavailableMessage = () =>
  process.platform === "win32"
    ? "Converting PowerPoint offline needs PowerPoint installed on this computer. Install it, or connect to the internet, and try again."
    : "Converting PowerPoint isn't available offline on this computer. Please connect to the internet and try again.";
