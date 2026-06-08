import { PoolClient } from "pg";
import { describe, expect, test } from "vitest";

import {
  SWEEP_IDLE_UNASSIGN_SQL,
  SWEEP_TIMER_TAKEOVERS_SQL,
} from "../../../server/src/middleware/screenSweepQueries";
import {
  becomeRoot,
  becomeUser,
  createOrganizations,
  createUsers,
  withRootDb,
} from "../helpers";

/**
 * Tests for the screen-idle sweeps
 */

let slugSeq = 0;
const uniqueSlug = (prefix: string) => `${prefix}-${++slugSeq}`;

/** A timestamp `secs` in the past, or null. */
const secondsAgo = (secs: number | null): Date | null =>
  secs == null ? null : new Date(Date.now() - secs * 1000);

/** Create a user + organization, then hand back a root client + org id. */
const withOrg = <T>(fn: (client: PoolClient, orgId: string) => Promise<T>) =>
  withRootDb(async (client) => {
    const [user] = await createUsers(client, 1);
    await becomeUser(client, user.id);
    const [org] = await createOrganizations(client, 1);
    await becomeRoot(client);
    await fn(client, org.id);
  });

const createProject = async (
  client: PoolClient,
  orgId: string,
  { isPublic = false }: { isPublic?: boolean } = {},
): Promise<string> => {
  const {
    rows: [project],
  } = await client.query(
    `insert into app_public.projects (organization_id, slug, name, is_public)
     values ($1, $2, $3, $4)
     returning id`,
    [orgId, uniqueSlug("project"), "Test Project", isPublic],
  );
  return project.id;
};

const createScreen = async (
  client: PoolClient,
  orgId: string,
  {
    currentProjectId = null,
    idlePolicy = "unassign",
    idleAfterSeconds = 30,
    unassignAfterIdleSeconds = 30,
  }: {
    currentProjectId?: string | null;
    idlePolicy?: "do_nothing" | "unassign";
    idleAfterSeconds?: number | null;
    unassignAfterIdleSeconds?: number | null;
  } = {},
): Promise<string> => {
  const {
    rows: [screen],
  } = await client.query(
    `insert into app_public.screens
       (organization_id, name, slug, current_project_id,
        idle_policy, idle_after_seconds, unassign_after_idle_seconds)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id`,
    [
      orgId,
      "Test Screen",
      uniqueSlug("screen"),
      currentProjectId,
      idlePolicy,
      idleAfterSeconds,
      unassignAfterIdleSeconds,
    ],
  );
  return screen.id;
};

/** Upsert a heartbeat row with explicit (past) timestamps. */
const setHeartbeat = async (
  client: PoolClient,
  screenId: string,
  { guestAgo, adminAgo }: { guestAgo: number | null; adminAgo: number | null },
) => {
  await client.query(
    `insert into app_public.screen_heartbeats
       (screen_id, last_seen_by_guest_at, last_seen_by_admin_at)
     values ($1, $2, $3)
     on conflict (screen_id) do update
       set last_seen_by_guest_at = excluded.last_seen_by_guest_at,
           last_seen_by_admin_at = excluded.last_seen_by_admin_at`,
    [screenId, secondsAgo(guestAgo), secondsAgo(adminAgo)],
  );
};

/** Seat an anonymous guest as the active controller of a screen. */
const seatGuest = async (
  client: PoolClient,
  orgId: string,
  screenId: string,
): Promise<string> => {
  const {
    rows: [session],
  } = await client.query(
    `insert into app_public.screen_guest_sessions
       (screen_id, organization_id, kind)
     values ($1, $2, 'anon')
     returning id`,
    [screenId, orgId],
  );
  await client.query(
    `insert into app_public.screen_active_controllers
       (screen_id, screen_guest_session_id)
     values ($1, $2)`,
    [screenId, session.id],
  );
  return session.id;
};

const getScreen = async (client: PoolClient, screenId: string) => {
  const {
    rows: [row],
  } = await client.query(
    "select current_project_id from app_public.screens where id = $1",
    [screenId],
  );
  return row;
};

const getSeatCount = async (client: PoolClient, screenId: string) => {
  const { rowCount } = await client.query(
    "select 1 from app_public.screen_active_controllers where screen_id = $1",
    [screenId],
  );
  return rowCount ?? 0;
};

describe("idle unassign sweep (return to standby)", () => {
  test("clears the project and removes the seat when both heartbeats are stale", () =>
    withOrg(async (client, orgId) => {
      const projectId = await createProject(client, orgId);
      const screenId = await createScreen(client, orgId, {
        currentProjectId: projectId,
        idleAfterSeconds: 30,
        unassignAfterIdleSeconds: 30,
      });
      await seatGuest(client, orgId, screenId);
      // Both well past the 60s total threshold.
      await setHeartbeat(client, screenId, { guestAgo: 3600, adminAgo: 3600 });

      await client.query(SWEEP_IDLE_UNASSIGN_SQL);

      expect((await getScreen(client, screenId)).current_project_id).toBeNull();
      expect(await getSeatCount(client, screenId)).toBe(0);
    }));

  test("keeps the screen assigned while admin activity is fresh", () =>
    withOrg(async (client, orgId) => {
      const projectId = await createProject(client, orgId);
      const screenId = await createScreen(client, orgId, {
        currentProjectId: projectId,
      });
      // Guest long gone, but an admin is still driving.
      await setHeartbeat(client, screenId, { guestAgo: 3600, adminAgo: 0 });

      await client.query(SWEEP_IDLE_UNASSIGN_SQL);

      expect((await getScreen(client, screenId)).current_project_id).toBe(
        projectId,
      );
    }));

  test("keeps the screen assigned while guest activity is fresh", () =>
    withOrg(async (client, orgId) => {
      const projectId = await createProject(client, orgId);
      const screenId = await createScreen(client, orgId, {
        currentProjectId: projectId,
      });
      await setHeartbeat(client, screenId, { guestAgo: 0, adminAgo: 3600 });

      await client.query(SWEEP_IDLE_UNASSIGN_SQL);

      expect((await getScreen(client, screenId)).current_project_id).toBe(
        projectId,
      );
    }));

  test("does nothing when idle_policy = 'do_nothing'", () =>
    withOrg(async (client, orgId) => {
      const projectId = await createProject(client, orgId);
      const screenId = await createScreen(client, orgId, {
        currentProjectId: projectId,
        idlePolicy: "do_nothing",
      });
      await setHeartbeat(client, screenId, { guestAgo: 3600, adminAgo: 3600 });

      await client.query(SWEEP_IDLE_UNASSIGN_SQL);

      expect((await getScreen(client, screenId)).current_project_id).toBe(
        projectId,
      );
    }));

  test("clears an admin-driven screen that has no active controller seat", () =>
    withOrg(async (client, orgId) => {
      const projectId = await createProject(client, orgId);
      // No seatGuest() call: this is the case the old seat-keyed sweep
      // could never reach.
      const screenId = await createScreen(client, orgId, {
        currentProjectId: projectId,
      });
      await setHeartbeat(client, screenId, { guestAgo: 3600, adminAgo: 3600 });

      await client.query(SWEEP_IDLE_UNASSIGN_SQL);

      expect((await getScreen(client, screenId)).current_project_id).toBeNull();
    }));

  test("does not clear a screen still within the idle window", () =>
    withOrg(async (client, orgId) => {
      const projectId = await createProject(client, orgId);
      const screenId = await createScreen(client, orgId, {
        currentProjectId: projectId,
        idleAfterSeconds: 30,
        unassignAfterIdleSeconds: 30,
      });
      // 40s < 60s total threshold -> not yet idle.
      await setHeartbeat(client, screenId, { guestAgo: 40, adminAgo: 40 });

      await client.query(SWEEP_IDLE_UNASSIGN_SQL);

      expect((await getScreen(client, screenId)).current_project_id).toBe(
        projectId,
      );
    }));
});

describe("heartbeat seeding trigger", () => {
  test("assigning a project seeds a heartbeat row with admin timestamp", () =>
    withOrg(async (client, orgId) => {
      const projectId = await createProject(client, orgId);
      const screenId = await createScreen(client, orgId, {
        currentProjectId: projectId,
      });

      const {
        rows: [hb],
      } = await client.query(
        `select last_seen_by_guest_at, last_seen_by_admin_at
         from app_public.screen_heartbeats where screen_id = $1`,
        [screenId],
      );

      expect(hb).toBeTruthy();
      expect(hb.last_seen_by_admin_at).not.toBeNull();
      expect(hb.last_seen_by_guest_at).toBeNull();
    }));
});
