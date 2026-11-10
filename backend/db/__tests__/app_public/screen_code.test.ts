import { PoolClient } from "pg";
import { describe, expect, test } from "vitest";

import {
  becomeRoot,
  becomeUser,
  createOrganizations,
  createUsers,
  withRootDb,
} from "../helpers";

/**
 * Screen codes are unique per server. Only cloud sync may bring one from the
 * other side.
 */

const withOrg = <T>(
  fn: (client: PoolClient, orgId: string) => Promise<T>,
  { sync = true } = {},
) =>
  withRootDb(async (client) => {
    const [user] = await createUsers(client, 1);
    await becomeUser(client, user.id);
    const [org] = await createOrganizations(client, 1);
    await becomeRoot(client);
    if (sync)
      await client.query("select set_config('app.cloud_sync', 'on', true)");
    await fn(client, org.id);
  });

const insertScreen = async (
  client: PoolClient,
  orgId: string,
  slug: string,
  code: string | null,
) => {
  const {
    rows: [row],
  } = await client.query(
    `insert into app_public.screens (organization_id, name, slug, code)
     values ($1, $4, $2, $3) returning id, code::text`,
    [orgId, slug, code, `Screen ${slug}`],
  );
  return row as { id: string; code: string };
};

describe("screen codes", () => {
  test("generates one when none is given", () =>
    withOrg(async (client, orgId) => {
      const { code } = await insertScreen(client, orgId, "a", null);
      expect(code).toMatch(/^[2-9A-HJKMNP-Z]{4}$/);
    }));

  test("generates one when the column is left out", () =>
    withOrg(async (client, orgId) => {
      const {
        rows: [row],
      } = await client.query(
        `insert into app_public.screens (organization_id, name, slug)
         values ($1, 'Screen', 'a') returning code::text`,
        [orgId],
      );
      expect(row.code).toMatch(/^[2-9A-HJKMNP-Z]{4}$/);
    }));

  test("ignores a chosen code outside sync", () =>
    withOrg(
      async (client, orgId) => {
        const { code } = await insertScreen(client, orgId, "a", "Q7W8");
        expect(code).not.toBe("Q7W8");
        expect(code).toMatch(/^[2-9A-HJKMNP-Z]{4}$/);
      },
      { sync: false },
    ));

  test("keeps a free code sync gives it, in upper case", () =>
    withOrg(async (client, orgId) => {
      const { code } = await insertScreen(client, orgId, "a", "q7w8");
      expect(code).toBe("Q7W8");
    }));

  test("replaces a malformed code", () =>
    withOrg(async (client, orgId) => {
      const { code } = await insertScreen(client, orgId, "a", "LOVE1");
      expect(code).not.toBe("LOVE1");
      expect(code).toMatch(/^[2-9A-HJKMNP-Z]{4}$/);
    }));

  test("gives a new screen a fresh code when its own is taken", () =>
    withOrg(async (client, orgId) => {
      await insertScreen(client, orgId, "a", "Q7W8");
      const { code } = await insertScreen(client, orgId, "b", "Q7W8");
      expect(code).not.toBe("Q7W8");
    }));

  test("leaves an existing screen's code alone when the new one is taken", () =>
    withOrg(async (client, orgId) => {
      await insertScreen(client, orgId, "a", "Q7W8");
      const b = await insertScreen(client, orgId, "b", "R7W8");
      const {
        rows: [row],
      } = await client.query(
        `update app_public.screens set code = 'Q7W8' where id = $1
         returning code::text`,
        [b.id],
      );
      expect(row.code).toBe("R7W8");
    }));
});
