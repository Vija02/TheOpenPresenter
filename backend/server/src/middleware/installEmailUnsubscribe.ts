import { logger } from "@repo/observability";
import { Express } from "express";

import { getRootPgPool } from "./installDatabasePools";

/**
 * Target of the `List-Unsubscribe` header on optional emails.
 *
 * - POST: RFC 8058 one-click unsubscribe, sent by mail apps (e.g. Gmail's
 *   "Unsubscribe" button). No login or CSRF token, the token in the URL is the
 *   proof. Bypasses CSRF in installCSRFProtection.ts.
 * - GET: mail apps without one-click support just open the link, so send them
 *   to the normal unsubscribe page.
 */
export const EMAIL_UNSUBSCRIBE_PATH = "/email/unsubscribe";

export default (app: Express) => {
  app.get(EMAIL_UNSUBSCRIBE_PATH, (req, res) => {
    const query = new URLSearchParams();
    if (typeof req.query.token === "string") {
      query.set("token", req.query.token);
    }
    if (typeof req.query.category === "string") {
      query.set("category", req.query.category);
    }
    res.redirect(302, `/unsubscribe?${query.toString()}`);
  });

  app.post(EMAIL_UNSUBSCRIBE_PATH, async (req, res) => {
    const { token, category } = req.query;
    if (typeof token !== "string" || typeof category !== "string") {
      res.status(400).send("Invalid unsubscribe link");
      return;
    }

    try {
      const {
        rows: [row],
      } = await getRootPgPool(app).query(
        "select app_public.set_email_subscription_by_token($1, $2::app_public.email_category, false) as ok",
        [token, category],
      );
      if (!row?.ok) {
        res.status(404).send("Invalid unsubscribe link");
        return;
      }
      res.status(200).send("Unsubscribed");
    } catch (e: any) {
      // 22P02: not a valid category
      if (e?.code === "22P02") {
        res.status(400).send("Invalid unsubscribe link");
        return;
      }
      logger.error({ err: e }, "One-click unsubscribe failed");
      res.status(500).send("Something went wrong");
    }
  });
};
