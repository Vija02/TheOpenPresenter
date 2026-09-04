import { logger } from "@repo/observability";
import { Express } from "express";
import { Pool } from "pg";

import { getRootPgPool } from "./installDatabasePools";

/** How often an open renderer session bumps `last_seen_at` */
const HEARTBEAT_INTERVAL_MS = 60_000;
const RECONNECT_GRACE_MS = 30_000;

export type RendererSessionParams = {
  client: "renderer" | "remote" | null;
  isPreview: boolean;
  rendererId: string;
  /** Stable per-provider id */
  instanceId: string | null;
};

type OpenSession = {
  sessionRowId: string;
  timer: NodeJS.Timeout;
  socketId: string;
  pendingClose?: { timer: NodeJS.Timeout; disconnectedAt: Date };
};

/**
 * A single websocket can carry several documents, and the connect/disconnect
 * hooks fire per document, so sessions are keyed by client instance + document
 * rather than by socket alone.
 */
const openSessions = new Map<string, OpenSession>();

const sessionKey = (instanceKey: string, projectId: string) =>
  `${instanceKey}:${projectId}`;

export const parseRendererSessionParams = (
  searchParams: URLSearchParams,
): RendererSessionParams => {
  const client = searchParams.get("client");
  const instanceId = searchParams.get("instanceId");

  return {
    client:
      client === "renderer" || client === "remote"
        ? (client as "renderer" | "remote")
        : null,
    isPreview: searchParams.get("preview") === "1",
    rendererId: searchParams.get("rendererId") || "1",
    instanceId:
      instanceId && instanceId !== "undefined" && instanceId !== "null"
        ? instanceId
        : null,
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
  set last_seen_at = $2::timestamptz,
      ended_at = $2::timestamptz,
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
  if (params.client !== "renderer") {
    return;
  }

  const key = sessionKey(params.instanceId ?? socketId, projectId);
  const existing = openSessions.get(key);

  if (existing) {
    // A reconnect of a session we already track: resume it instead of opening
    // a second, overlapping row.
    if (existing.pendingClose) {
      clearTimeout(existing.pendingClose.timer);
      existing.pendingClose = undefined;
    }
    existing.socketId = socketId;
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

    openSessions.set(key, { sessionRowId: row.id, timer, socketId });
  } catch (err) {
    logger.warn({ err, projectId }, "Failed to open renderer session");
  }
};

const closeSession = async ({
  app,
  key,
  open,
  endedAt,
}: {
  app: Express;
  key: string;
  open: OpenSession;
  endedAt: Date;
}) => {
  clearInterval(open.timer);
  openSessions.delete(key);

  const rootPgPool: Pool = getRootPgPool(app);

  try {
    const {
      rows: [row],
    } = await rootPgPool.query(CLOSE_SESSION_SQL, [open.sessionRowId, endedAt]);

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

export const endRendererSession = async ({
  app,
  socketId,
  projectId,
  params,
}: {
  app: Express;
  socketId: string;
  projectId: string;
  params: RendererSessionParams;
}) => {
  const key = sessionKey(params.instanceId ?? socketId, projectId);
  const open = openSessions.get(key);
  if (!open) return;

  // A socket the client already replaced
  if (open.socketId !== socketId) return;

  if (open.pendingClose) return;

  const disconnectedAt = new Date();
  const timer = setTimeout(() => {
    const current = openSessions.get(key);
    if (!current || current.sessionRowId !== open.sessionRowId) return;

    void closeSession({ app, key, open: current, endedAt: disconnectedAt });
  }, RECONNECT_GRACE_MS);
  timer.unref?.();

  open.pendingClose = { timer, disconnectedAt };
};
