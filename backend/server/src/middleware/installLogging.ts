import { trace } from "@opentelemetry/api";
import { Express, RequestHandler } from "express";
import morgan from "morgan";

import { getWebsocketMiddlewares } from "../app";

const isDev = process.env.NODE_ENV === "development";

export default (app: Express) => {
  const sessionTracerMiddleware: RequestHandler = (req, res, next) => {
    const span = trace.getActiveSpan();
    if (span) {
      if (req.user && req.user.session_id) {
        span.setAttribute("user.is_authenticated", true);
        span.setAttribute("user.session_id", req.user.session_id);
      } else {
        span.setAttribute("user.is_authenticated", false);
      }
    }
    next();
  };

  app.use(sessionTracerMiddleware);
  getWebsocketMiddlewares(app).push(sessionTracerMiddleware);

  if (isDev) {
    // To enable logging on development, uncomment the next line:
    // app.use(morgan("tiny"));
  } else {
    app.use(morgan(isDev ? "tiny" : "combined"));
  }
};
