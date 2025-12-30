import { logger } from "@repo/observability";
import { json } from "body-parser";
import { Express } from "express";
import { z } from "zod";

import { withUserPgPool } from "../utils/withUserPgPool";

const devicePingSchema = z.object({
  organizationSlug: z.string(),
  irohEndpointId: z.string().min(1),
  irohTicket: z.string().min(1),
});

export default (app: Express) => {
  /**
   * This is how we know the devices that are active
   */
  app.post("/device/server/ping", json(), async (req, res) => {
    const sessionId = req.user?.session_id;

    // If no session id, then not logged in
    if (!sessionId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    // Validate request body with Zod
    const parseResult = devicePingSchema.safeParse(req.body);
    if (!parseResult.success) {
      logger.debug({ body: req.body }, "Invalid body on device ping");
      res.status(400).json({
        error: "Invalid request body",
        details: parseResult.error.flatten(),
      });
      return;
    }

    // DEBT: This should take just the ticket, and we can infer the endpoint from there
    const { organizationSlug, irohEndpointId, irohTicket } = parseResult.data;

    try {
      await withUserPgPool(app, sessionId, async (client) => {
        await client.query(
          `INSERT INTO app_public.organization_active_devices (organization_id, iroh_endpoint_id, iroh_ticket, updated_at)
           VALUES ((SELECT id FROM app_public.organizations WHERE slug = $1), $2, $3, NOW())
           ON CONFLICT (organization_id, iroh_endpoint_id)
           DO UPDATE SET
             iroh_ticket = EXCLUDED.iroh_ticket,
             updated_at = NOW()`,
          [organizationSlug, irohEndpointId, irohTicket],
        );
      });

      res.status(200).json({ success: true });
    } catch (err) {
      // DEBT: don't error if invalid org
      logger.error({ err }, "Failed to process device ping");
      res.status(500).json({ error: "Failed to update device status" });
    }
  });
};
