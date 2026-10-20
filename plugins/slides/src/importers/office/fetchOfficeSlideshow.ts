import axios from "axios";
import pLimit from "p-limit";
import { pino } from "pino";

import { collectSlideImageIds, normalizeSlide } from "../../office/normalize";
import type { OfficeDeck } from "../../office/types";
import {
  OFFICE_CANNOT_OPEN,
  OFFICE_NOT_READY,
  USER_AGENT,
  bootstrapOfficeOnline,
  createCannotOpenTracker,
  officeServiceHeaders,
  safeJson,
  sleep,
} from "./officeOnline";

/**
 * Downloads a deck as PowerPoint for the web's slideshow plays it: per-slide
 * shape layout and animation data, plus the sprite sheets the server renders
 * each shape into (transparent PNGs). See `docs/OFFICE-ONLINE-SLIDESHOW.md`.
 *
 * Nothing here needs a browser or a session: the same `presentationId` the PDF
 * export uses works for every call, and the images are plain GETs.
 *
 *   1. GET  embed.aspx?src=<publicPptUrl>          -> cluster host + WOPISrc
 *   2. POST GetPresentationWithSlideById (poll 59) -> slide list, render size
 *   3. POST GetSlide, once per slide               -> shapes, sprites, animations
 *   4. GET  imagehandler.ashx?...&Rid=<id>.png     -> sprite sheets
 */

/** `format` picks the render size: 6 is 1920x1080, the largest on offer */
const FORMAT_1080P = 6;
/** Slideshow ("reading") view */
const SLIDESHOW_VIEW = 6;

type DownloadedFile = { buffer: Buffer; extension: string };

export type OfficeSlideshowResult = {
  deck: OfficeDeck;
  /** Sprite sheet id -> PNG bytes. `deck.images` is left for the caller to fill */
  images: Map<string, DownloadedFile>;
  /** Embedded video/audio id -> file. `deck.media` is left for the caller */
  media: Map<string, DownloadedFile>;
};

/** File extension for embedded media, from its type or its id (`123.mp4.media`) */
export const mediaExtension = (contentType: string, id: string) => {
  const fromType: Record<string, string> = {
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
    "video/x-ms-wmv": "wmv",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
  };
  const known = fromType[contentType.split(";")[0]!.trim().toLowerCase()];
  if (known) return known;
  const fromId = id.split(".")[1];
  return fromId && /^[a-z0-9]{1,12}$/i.test(fromId)
    ? fromId.toLowerCase()
    : "bin";
};

interface FetchOptions {
  attempts?: number;
  pollIntervalMs?: number;
  requestTimeoutMs?: number;
  concurrency?: number;
}

export async function fetchOfficeSlideshow(
  publicPptUrl: string,
  log: pino.Logger,
  opts: FetchOptions = {},
): Promise<OfficeSlideshowResult> {
  const attempts = opts.attempts ?? 30;
  const pollIntervalMs = opts.pollIntervalMs ?? 2000;
  const timeout = opts.requestTimeoutMs ?? 60000;
  const limit = pLimit(opts.concurrency ?? 4);

  const { host, presentationId } = await bootstrapOfficeOnline(
    publicPptUrl,
    timeout,
  );
  log.trace({ host }, "Office slideshow: cluster assigned");

  const call = async (method: string, body: Record<string, unknown>) => {
    const checkCannotOpen = createCannotOpenTracker();
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const res = await axios.post(
        `https://${host}/p/ppt/view.https.svc/jsonAnonymous/${method}`,
        JSON.stringify({ presentationId, ...body }),
        {
          headers: officeServiceHeaders(host),
          responseType: "json",
          timeout,
          validateStatus: () => true,
        },
      );
      const data = typeof res.data === "string" ? safeJson(res.data) : res.data;
      if (data?.Result) return data.Result;

      const code = data?.Error?.Code;
      checkCannotOpen(code);
      if (code !== OFFICE_NOT_READY && code !== OFFICE_CANNOT_OPEN) {
        throw new Error(
          `Office slideshow: ${method} failed (${code ?? res.status}: ${data?.Error?.Message ?? "no message"})`,
        );
      }
      log.trace({ method, attempt }, "Office slideshow: not rendered yet");
      await sleep(pollIntervalMs);
    }
    throw new Error(`Office slideshow: ${method} never became ready`);
  };

  const presentation = await call("GetPresentationWithSlideById", {
    slideId: "0",
    slideIndex: 0,
    powerpointView: SLIDESHOW_VIEW,
    format: FORMAT_1080P,
  });

  const slideList: { sldInfo: string }[] = presentation.sldLst ?? [];
  log.info(
    { slides: slideList.length, width: presentation.w, height: presentation.h },
    "Office slideshow: presentation info received",
  );

  const rawSlides = await Promise.all(
    slideList.map((entry) =>
      limit(async () => {
        const result = await call("GetSlide", {
          slideInfoId: entry.sldInfo,
          powerpointView: SLIDESHOW_VIEW,
          format: FORMAT_1080P,
        });
        const sld = result?.sld?.[0];
        if (!sld) throw new Error("Office slideshow: GetSlide had no slide");
        return sld as Record<string, any>;
      }),
    ),
  );

  const slides = rawSlides.map(normalizeSlide);

  // Every sprite sheet any slide uses, with where to get it
  const sources = new Map<string, { name: string; base64: string }>();
  for (const sld of rawSlides) {
    for (const res of (sld.resCat ?? []) as Record<string, string>[]) {
      if (res.id && !sources.has(res.id)) {
        sources.set(res.id, { name: res.name ?? "", base64: res.base64 ?? "" });
      }
    }
  }
  const needed = new Set(slides.flatMap((s) => [...collectSlideImageIds(s)]));

  const images = new Map<string, { buffer: Buffer; extension: string }>();
  await Promise.all(
    [...needed].map((id) =>
      limit(async () => {
        const source = sources.get(id);
        if (!source) {
          log.warn({ id }, "Office slideshow: sprite missing from catalog");
          return;
        }
        if (source.base64) {
          images.set(id, {
            buffer: Buffer.from(source.base64, "base64"),
            extension: "png",
          });
          return;
        }
        const url = new URL(
          source.name.replace(/^\.\//, ""),
          `https://${host}/p/`,
        ).toString();
        for (let attempt = 1; attempt <= 3; attempt++) {
          const res = await axios.get(url, {
            headers: { "User-Agent": USER_AGENT },
            responseType: "arraybuffer",
            timeout,
            validateStatus: () => true,
          });
          const type = String(res.headers["content-type"] ?? "");
          if (res.status === 200 && type.startsWith("image/")) {
            images.set(id, {
              buffer: Buffer.from(res.data),
              extension: type.includes("gif") ? "gif" : "png",
            });
            return;
          }
          await sleep(pollIntervalMs);
        }
        throw new Error(`Office slideshow: could not download sprite ${id}`);
      }),
    ),
  );

  // Embedded videos/sounds, fetched the same way as the sprites
  const mediaSources = new Map<string, { src: string; contentType: string }>();
  for (const sld of rawSlides) {
    for (const sp of (sld.spLst ?? []) as Record<string, any>[]) {
      const item = sp.media?.Item;
      if (
        typeof item?.__type === "string" &&
        item.__type.startsWith("CT_MediaLocal:") &&
        typeof item.id === "string" &&
        typeof item.src === "string"
      ) {
        mediaSources.set(item.id, {
          src: item.src,
          contentType: item.ct ?? "",
        });
      }
    }
  }
  const media = new Map<string, DownloadedFile>();
  await Promise.all(
    [...mediaSources.entries()].map(([id, source]) =>
      limit(async () => {
        const url = new URL(
          source.src.replace(/^\.\//, ""),
          `https://${host}/p/`,
        ).toString();
        const res = await axios.get(url, {
          headers: { "User-Agent": USER_AGENT },
          responseType: "arraybuffer",
          timeout: Math.max(timeout, 5 * 60 * 1000),
          validateStatus: () => true,
        });
        if (res.status !== 200) {
          // A missing video shouldn't cost the deck its animations
          log.warn(
            { id, status: res.status },
            "Office slideshow: media not downloaded",
          );
          return;
        }
        media.set(id, {
          buffer: Buffer.from(res.data),
          extension: mediaExtension(source.contentType, id),
        });
      }),
    ),
  );

  return {
    media,
    deck: {
      width: presentation.w,
      height: presentation.h,
      images: {},
      slides,
    },
    images,
  };
}
