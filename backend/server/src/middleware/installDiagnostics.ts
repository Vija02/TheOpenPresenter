import { logger } from "@repo/observability";
import { json } from "body-parser";
import { Express } from "express";

interface LogFilePayload {
  name: string;
  content: string;
  truncated: boolean;
}

// Receives a diagnosis bundle from the Tauri app
export default (app: Express) => {
  app.post("/diagnostics/report", json({ limit: "1mb" }), async (req, res) => {
    try {
      const { systemInfo, logs } = req.body ?? {};
      if (!systemInfo) {
        res.status(400).json({ error: "Missing systemInfo" });
        return;
      }

      logger.info(
        {
          diagnosis: {
            systemInfo,
            logs: (Array.isArray(logs) ? logs : []) as LogFilePayload[],
          },
        },
        "Received device diagnosis report",
      );

      res.json({ success: true });
    } catch (err) {
      logger.error({ err }, "Error handling /diagnostics/report request");
      res.status(500).json({ error: "Internal server error" });
    }
  });
};
