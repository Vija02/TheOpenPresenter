import { logger } from "@repo/observability";
import { Express } from "express";
import { Pool } from "pg";

import { getRootPgPool } from "./installDatabasePools";

/** How often an open renderer session bumps `last_seen_at` */
const HEARTBEAT_INTERVAL_MS = 60_000;

export type RendererSessionParams = {
  client: "renderer" | "remote" | null;
  isPreview: boolean;
  rendererId: string;
};

type OpenSession = {
  sessionRowId: string;
  timer: NodeJS.Timeout;
};

/**
 * A single websocket can carry several documents, and the connect/disconnect
 * hooks fire per document, so sessions are keyed by socket + document rather
 * than by socket alone.
 */
const openSessions = new Map<string, OpenSession>();

const sessionKey = (socketId: string, projectId: string) =>
  `${socketId}:${projectId}`;

export const parseRendererSessionParams = (
  searchParams: URLSearchParams,
): RendererSessionParams => {
  const client = searchParams.get("client");

  return {
    client:
      client === "renderer" || client === "remote"
        ? (client as "renderer" | "remote")
        : null,
    isPreview: searchParams.get("preview") === "1",
    rendererId: searchParams.get("rendererId") || "1",
  };
};

const INSERT_SESSION_SQL = `
  insert into app_private.renderer_sessions
    (organization_id, project_id, screen_id, user_id, renderer_id, is_preview)
  select
    p.organization_id,
    p.id,
    $2::uuid,
    (select s.user_id from app_private.sessions s where s.uuid = $3::uuid),
    $4::text,
    $5::boolean
  from app_public.projects p
  where p.id = $1::uuid
  returning id
`;

const HEARTBEAT_SQL = `
  update app_private.renderer_sessions
  set last_seen_at = now()
  where id = $1::uuid
    and ended_at is null
`;

const CLOSE_SESSION_SQL = `
  update app_private.renderer_sessions
  set last_seen_at = now(),
      ended_at = now(),
      end_reason = 'disconnect'
  where id = $1::uuid
    and ended_at is null
  returning
    organization_id,
    project_id,
    screen_id,
    is_preview,
    extract(epoch from ended_at - started_at)::int as duration_seconds
`;

export const startRendererSession = async ({
  app,
  socketId,
  projectId,
  screenId,
  sessionId,
  params,
}: {
  app: Express;
  socketId: string;
  projectId: string;
  screenId: string | null;
  sessionId: string | null;
  params: RendererSessionParams;
}) => {
  const key = sessionKey(socketId, projectId);

  if (params.client !== "renderer" || openSessions.has(key)) {
    return;
  }

  const rootPgPool = getRootPgPool(app);

  try {
    const {
      rows: [row],
    } = await rootPgPool.query(INSERT_SESSION_SQL, [
      projectId,
      screenId,
      sessionId,
      params.rendererId,
      params.isPreview,
    ]);

    if (!row) return;

    const timer = setInterval(() => {
      rootPgPool.query(HEARTBEAT_SQL, [row.id]).catch((err) => {
        logger.warn({ err }, "Failed to bump renderer session heartbeat");
      });
    }, HEARTBEAT_INTERVAL_MS);
    timer.unref?.();

    openSessions.set(key, { sessionRowId: row.id, timer });
  } catch (err) {
    logger.warn({ err, projectId }, "Failed to open renderer session");
  }
};

export const endRendererSession = async ({
  app,
  socketId,
  projectId,
}: {
  app: Express;
  socketId: string;
  projectId: string;
}) => {
  const key = sessionKey(socketId, projectId);
  const open = openSessions.get(key);
  if (!open) return;

  clearInterval(open.timer);
  openSessions.delete(key);

  const rootPgPool: Pool = getRootPgPool(app);

  try {
    const {
      rows: [row],
    } = await rootPgPool.query(CLOSE_SESSION_SQL, [open.sessionRowId]);

    if (!row) return;

    logger.info(
      {
        event: "renderer.session.ended",
        rendererSessionId: open.sessionRowId,
        organizationId: row.organization_id,
        projectId: row.project_id,
        screenId: row.screen_id,
        isPreview: row.is_preview,
        durationSeconds: row.duration_seconds,
      },
      "Renderer session ended",
    );
  } catch (err) {
    logger.warn({ err }, "Failed to close renderer session");
  }
};
