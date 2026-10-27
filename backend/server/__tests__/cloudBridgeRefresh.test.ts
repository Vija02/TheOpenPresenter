import { Pool } from "pg";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import * as Y from "yjs";

import { TEST_DATABASE_URL, poolFromUrl } from "../../__tests__/helpers";

// Opening a real bridge connects to the cloud; record it instead.
const registry = vi.hoisted(() => {
  const bridged = new Set<string>();
  return {
    bridged,
    openBridge: vi.fn(async ({ localProjectId }: { localProjectId: string }) => {
      bridged.add(localProjectId);
    }),
    closeBridge: vi.fn(async (localProjectId: string) => {
      bridged.delete(localProjectId);
    }),
    getSyncState: (localProjectId: string) =>
      bridged.has(localProjectId) ? { localProjectId } : null,
  };
});
vi.mock("../src/middleware/cloudDocumentBridge/registry", () => registry);

import { refreshLoadedBridges } from "../src/middleware/cloudDocumentBridge/eligibility";

/**
 * After a sync connected or deleted projects: the loaded documents it
 * connected get a bridge, and the ones it deleted lose theirs.
 */

const ORG_PREFIX = "testcloudbridgerefresh";

let pool: Pool;
let orgId: string;
let connectionId: string;

const query = async (text: string, params: unknown[] = []) =>
  (await pool.query(text, params)).rows;

const addProject = async (name: string, connected: boolean) =>
  (
    await query(
      `insert into app_public.projects
         (organization_id, slug, name, cloud_connection_id, cloud_project_id)
       values ($1, $2, $3, $4, case when $5 then gen_random_uuid() end)
       returning id`,
      [orgId, name, name, connected ? connectionId : null, connected],
    )
  )[0].id as string;

const loaded = (...ids: string[]) =>
  new Map(ids.map((id) => [id, new Y.Doc()]));

beforeAll(() => {
  pool = poolFromUrl(TEST_DATABASE_URL);
});

beforeEach(async () => {
  registry.bridged.clear();
  registry.openBridge.mockClear();
  registry.closeBridge.mockClear();
  [{ id: orgId }] = await query(
    `insert into app_public.organizations (slug, name)
     values ($1, 'Bridge refresh') returning id`,
    [`${ORG_PREFIX}-${Date.now()}`],
  );
  [{ id: connectionId }] = await query(
    `insert into app_public.cloud_connections
       (organization_id, host, session_cookie, session_cookie_expiry, target_organization_slug)
     values ($1, 'http://cloud.test', 'session=test', now() + interval '1 day', 'cloudorg')
     returning id`,
    [orgId],
  );
});

afterEach(async () => {
  await query(`delete from app_public.organizations where slug like $1`, [
    `${ORG_PREFIX}-%`,
  ]);
});

describe("refreshLoadedBridges", () => {
  it("bridges a loaded project that now has a cloud copy", async () => {
    const id = await addProject("connected", true);

    await refreshLoadedBridges(pool, loaded(id));

    expect(registry.openBridge).toHaveBeenCalledWith(
      expect.objectContaining({ localProjectId: id, host: "http://cloud.test" }),
    );
  });

  it("leaves alone projects without a cloud copy, or already bridged", async () => {
    const local = await addProject("local", false);
    const bridged = await addProject("bridged", true);
    registry.bridged.add(bridged);

    await refreshLoadedBridges(pool, loaded(local, bridged));

    expect(registry.openBridge).not.toHaveBeenCalled();
    expect(registry.closeBridge).not.toHaveBeenCalled();
  });

  it("closes the bridge of a project the sync deleted", async () => {
    const id = await addProject("deleted", true);
    registry.bridged.add(id);
    await query(`delete from app_public.projects where id = $1`, [id]);

    await refreshLoadedBridges(pool, loaded(id));

    expect(registry.closeBridge).toHaveBeenCalledWith(id);
  });

  it("skips documents that are not projects", async () => {
    await refreshLoadedBridges(pool, loaded("not-a-project"));

    expect(registry.openBridge).not.toHaveBeenCalled();
  });
});
