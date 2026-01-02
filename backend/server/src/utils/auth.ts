import { Express } from "express";

import { withUserPgPool } from "./withUserPgPool";

export const checkUserAuth = async (
  app: Express,
  {
    organizationId,
    sessionId,
    projectId,
  }: { organizationId: string; sessionId: string; projectId?: string },
) => {
  return await withUserPgPool(app, sessionId, async (client) => {
    const {
      rows: [row],
    } = await client.query(
      "select * from app_public.organizations where id = $1",
      [organizationId],
    );
    if (!row) {
      throw new Error("Not Authorized");
    }
    if (projectId) {
      const {
        rows: [projectRow],
      } = await client.query(
        "select * from app_public.projects where id = $1",
        [projectId],
      );
      if (!projectRow) {
        throw new Error("Not Authorized");
      }
    }
    const {
      rows: [user],
    } = await client.query("select app_public.current_user_id() as id");

    return user.id;
  });
};
