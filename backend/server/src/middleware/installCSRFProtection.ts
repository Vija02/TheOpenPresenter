import csrf from "csurf";
import { Express } from "express";

import { EMAIL_UNSUBSCRIBE_PATH } from "./installEmailUnsubscribe";

export default (app: Express) => {
  const csrfProtection = csrf({
    // Store to the session rather than a Cookie
    cookie: false,

    // Extract the CSRF Token from the `CSRF-Token` header.
    value(req) {
      const csrfToken = req.headers["csrf-token"];
      return typeof csrfToken === "string" ? csrfToken : "";
    },
  });

  app.use((req, res, next) => {
    if (!!req.headers["x-top-csrf-protection"]) {
      next();
    } else if (
      req.method === "POST" &&
      req.path === "/graphql" &&
      (req.headers.referer === `${process.env.ROOT_URL}/graphiql` ||
        req.headers.origin === process.env.ROOT_URL)
    ) {
      // Bypass CSRF for GraphiQL
      next();
    } else if (req.method === "POST" && req.path === "/stripe/webhook") {
      // Bypass CSRF for Stripe webhook
      next();
    } else if (req.method === "POST" && req.path === EMAIL_UNSUBSCRIBE_PATH) {
      // Bypass CSRF for one-click unsubscribe from mail apps (token in URL)
      next();
    } else {
      csrfProtection(req, res, next);
    }
  });

  /** Re-issues a token for the current session */
  app.get("/csrf-token", csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
  });
};
