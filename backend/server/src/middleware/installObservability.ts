import { Express, RequestHandler } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

const requireAuth: RequestHandler<any, any, (err?: any) => void> = (
  req,
  res,
  next,
) => {
  if (req.user?.session_id) {
    next();
  } else {
    res.status(401).send("Unauthorized");
  }
};

export default (app: Express) => {
  if (process.env.OTLP_HOST) {
    const otlpTracesProxy = createProxyMiddleware({
      target: process.env.OTLP_HOST + "/v1/traces",
      changeOrigin: true,
      on: {
        proxyReq: (proxyReq) => {
          if (proxyReq.path.endsWith("/")) {
            proxyReq.path = proxyReq.path.slice(0, -1);
          }
        },
      },
    });
    const otlpLogsProxy = createProxyMiddleware({
      target: process.env.OTLP_HOST + "/v1/logs",
      changeOrigin: true,
      on: {
        proxyReq: (proxyReq) => {
          if (proxyReq.path.endsWith("/")) {
            proxyReq.path = proxyReq.path.slice(0, -1);
          }
        },
      },
    });

    app.use("/otlp/v1/traces", requireAuth, otlpTracesProxy);
    app.use("/otlp/v1/logs", requireAuth, otlpLogsProxy);
  }
};
