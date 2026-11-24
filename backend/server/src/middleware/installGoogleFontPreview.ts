import { logger } from "@repo/observability";
import { Express } from "express";

import {
  fetchGooglePreviewCss,
  getGoogleFontCatalog,
} from "../api/fonts/googleFonts";

/**
 * Preview stylesheets, fetched here so the family can be renamed (see
 * `fetchGooglePreviewCss`). Logged-in users and catalog families only, so it
 * isn't an open proxy.
 */
export const GOOGLE_FONT_PREVIEW_PATH = "/fonts/google-preview.css";

const MAX_CACHED = 2000;
const cache = new Map<string, Promise<string>>();

export default (app: Express) => {
  app.get(GOOGLE_FONT_PREVIEW_PATH, async (req, res) => {
    if (!req.user?.session_id) {
      res.status(401).send("Not logged in");
      return;
    }
    const { family, text } = req.query;
    if (typeof family !== "string" || typeof text !== "string" || !text) {
      res.status(400).send("family and text are required");
      return;
    }

    try {
      const catalog = await getGoogleFontCatalog();
      if (!catalog.some((f) => f.family === family)) {
        res.status(404).send("Font not found");
        return;
      }

      const key = `${family}\n${text}`;
      let css = cache.get(key);
      if (!css) {
        css = fetchGooglePreviewCss(family, text);
        cache.set(key, css);
        css.catch(() => cache.delete(key));
        if (cache.size > MAX_CACHED) {
          cache.delete(cache.keys().next().value!);
        }
      }

      res
        .type("text/css")
        .set("cache-control", "private, max-age=86400")
        .send(await css);
    } catch (err) {
      logger.warn({ err, family }, "Google font preview failed");
      res.status(502).send("Couldn't reach Google Fonts");
    }
  });
};
