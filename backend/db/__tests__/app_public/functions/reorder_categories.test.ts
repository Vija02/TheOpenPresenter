import { PoolClient } from "pg";
import { describe, expect, it } from "vitest";

import {
  becomeRoot,
  becomeUser,
  createOrganizations,
  createUsers,
  withRootDb,
} from "../../helpers";

const setup = async (client: PoolClient) => {
  const [user, outsider] = await createUsers(client, 2);
  await becomeUser(client, user.id);
  const [org] = await createOrganizations(client, 1);
  // Orgs start with some default categories
  const { rows: existing } = await client.query(
    `select id from app_public.categories where organization_id = $1 order by sort_order`,
    [org.id],
  );
  const ids: string[] = [];
  for (const name of ["A", "B", "C"]) {
    const { rows } = await client.query(
      `insert into app_public.categories (organization_id, name) values ($1, $2) returning id, sort_order`,
      [org.id, name],
    );
    ids.push(rows[0].id);
  }
  return { user, outsider, org, ids, existing: existing.length };
};

const order = async (client: PoolClient, orgId: string) => {
  await becomeRoot(client);
  const { rows } = await client.query(
    `select name, sort_order from app_public.categories where organization_id = $1 and name in ('A', 'B', 'C') order by sort_order`,
    [orgId],
  );
  return rows.map((r) => [r.name, r.sort_order]);
};

describe("category order", () => {
  it("appends new categories to the end", () =>
    withRootDb(async (client) => {
      const { org, existing } = await setup(client);
      expect(await order(client, org.id)).toEqual([
        ["A", existing],
        ["B", existing + 1],
        ["C", existing + 2],
      ]);
    }));

  it("reorders categories", () =>
    withRootDb(async (client) => {
      const { user, org, ids } = await setup(client);
      await becomeUser(client, user.id);
      const { rows } = await client.query(
        `select * from app_public.reorder_categories($1)`,
        [[ids[2], ids[0], ids[1]]],
      );
      expect(rows).toHaveLength(3);
      expect(await order(client, org.id)).toEqual([
        ["C", 0],
        ["A", 1],
        ["B", 2],
      ]);
    }));

  it("doesn't touch another org's categories", () =>
    withRootDb(async (client) => {
      const { outsider, org, ids, existing } = await setup(client);
      await becomeUser(client, outsider.id);
      const { rows } = await client.query(
        `select * from app_public.reorder_categories($1)`,
        [[ids[2], ids[0], ids[1]]],
      );
      expect(rows).toHaveLength(0);
      expect(await order(client, org.id)).toEqual([
        ["A", existing],
        ["B", existing + 1],
        ["C", existing + 2],
      ]);
    }));
});
