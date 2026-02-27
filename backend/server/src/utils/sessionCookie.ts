import { logger } from "@repo/observability";
import * as cookie from "cookie";
import signature from "cookie-signature";
import { Express } from "express";
import { Pool } from "pg";
import uid from "uid-safe";

import { getSessionStore } from "../middleware/installSession";

export interface SessionCookieOptions {
  userId: string;
  maxAgeMs?: number;
}

const DEFAULT_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

/**
 * Creates a session in the database and returns a signed session cookie.
 * This follows the express-session format so it can be used for authenticated requests.
 */
export async function createSessionCookie(
  app: Express,
  rootPgPool: Pool,
  options: SessionCookieOptions,
): Promise<string | null> {
  const { userId, maxAgeMs = DEFAULT_MAX_AGE_MS } = options;

  try {
    // Create session in database
    const { rows } = await rootPgPool.query<{ uuid: string }>(
      `INSERT INTO app_private.sessions (user_id) VALUES ($1) RETURNING uuid`,
      [userId],
    );

    if (rows.length === 0) {
      logger.error({ userId }, "Failed to create session - no rows returned");
      return null;
    }

    const sessionUuid = rows[0]!.uuid;

    // Create the session data - following how express-session does it
    const sid = uid.sync(24);
    const sessionData = {
      cookie: {
        originalMaxAge: maxAgeMs,
        expires: new Date(Date.now() + maxAgeMs).toISOString(),
        httpOnly: true,
        path: "/",
        sameSite: "lax",
      },
      passport: {
        user: sessionUuid,
      },
    };

    // Store in the session store (Redis or Postgres)
    const store = getSessionStore(app);
    await new Promise<void>((resolve, reject) => {
      store.set(sid, sessionData as any, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Format the cookie with signature
    const signed = "s:" + signature.sign(sid, process.env.SECRET!);
    const cookieValue = cookie.serialize("connect.sid", signed);

    logger.debug({ userId }, "Created session cookie");

    return cookieValue;
  } catch (err) {
    logger.error({ userId, err }, "Failed to create session cookie");
    return null;
  }
}
