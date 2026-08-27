import { logger } from "@repo/observability";
import { Express, Request } from "express";

import { getRootPgPool } from "./installDatabasePools";
import { applySessionMaxAge } from "./installSession";

declare module "express-session" {
  interface SessionData {
    /** Session id of the admin */
    impersonatorSessionId?: string;
  }
}

interface UserRow {
  id: string;
  username: string;
  is_admin: boolean;
}

export default (app: Express) => {
  const rootPgPool = getRootPgPool(app);

  const login = (req: Request, sessionId: string) =>
    new Promise<void>((resolve, reject) => {
      applySessionMaxAge(req);
      req.login(
        { session_id: sessionId },
        { session: true, keepSessionInfo: true },
        (err: any) => (err ? reject(err) : resolve()),
      );
    });

  const getUserBySessionId = async (sessionId: string) => {
    const {
      rows: [user],
    } = await rootPgPool.query<UserRow>(
      `select u.id, u.username, u.is_admin
         from app_private.sessions s
         join app_public.users u on u.id = s.user_id
        where s.uuid = $1`,
      [sessionId],
    );
    return user ?? null;
  };

  app.get("/admin/impersonate", async (req, res) => {
    const target = req.query.user?.toString();
    const next = req.query.next?.toString() || "/o";

    if (!req.user?.session_id) {
      res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
      return;
    }

    const actor = await getUserBySessionId(req.user.session_id);

    if (!actor?.is_admin) {
      logger.warn(
        { sessionId: req.user.session_id, target },
        "Non-admin attempted to impersonate",
      );
      res.sendStatus(404);
      return;
    }

    if (!target) {
      res.status(400).json({
        error:
          "Specify the user to impersonate, e.g. ?user=<username|email|id>",
      });
      return;
    }

    const {
      rows: [user],
    } = await rootPgPool.query<UserRow>(
      `select u.id, u.username, u.is_admin
         from app_public.users u
         left join app_public.user_emails ue on ue.user_id = u.id
        where u.username = $1
           or ue.email = $1
           or u.id::text = $1
        limit 1`,
      [target],
    );

    if (!user) {
      res.status(404).json({ error: `No user matching ${target}` });
      return;
    }

    const {
      rows: [session],
    } = await rootPgPool.query<{ uuid: string }>(
      `insert into app_private.sessions (user_id) values ($1) returning uuid`,
      [user.id],
    );

    if (!session) {
      res.status(500).json({ error: "Failed to create session" });
      return;
    }

    const impersonatorSessionId =
      req.session.impersonatorSessionId ?? req.user.session_id;

    logger.info(
      {
        adminId: actor.id,
        adminUsername: actor.username,
        targetId: user.id,
        targetUsername: user.username,
      },
      "Impersonation started",
    );

    await login(req, session.uuid);
    req.session.impersonatorSessionId = impersonatorSessionId;
    res.redirect(next);
  });

  app.get("/admin/impersonate/stop", async (req, res) => {
    const impersonatorSessionId = req.session?.impersonatorSessionId;

    if (!impersonatorSessionId) {
      res.redirect("/o");
      return;
    }

    const actor = await getUserBySessionId(impersonatorSessionId);

    if (!actor?.is_admin) {
      // The admin's own session expired or was revoked while impersonating.
      delete req.session.impersonatorSessionId;
      res.redirect("/logout");
      return;
    }

    // Drop the throwaway session we minted for the impersonation.
    if (req.user?.session_id) {
      await rootPgPool.query(
        `delete from app_private.sessions where uuid = $1`,
        [req.user.session_id],
      );
    }

    logger.info(
      { adminId: actor.id, adminUsername: actor.username },
      "Impersonation stopped",
    );

    await login(req, impersonatorSessionId);
    delete req.session.impersonatorSessionId;
    res.redirect("/o");
  });
};
