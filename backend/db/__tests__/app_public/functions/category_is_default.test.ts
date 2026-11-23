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
  const [user] = await createUsers(client, 1);
  await becomeUser(client, user.id);
  const [org, other] = await createOrganizations(client, 2);
  const add = async (orgId: string, name: string, isDefault = false) => {
    const { rows } = await client.query(
      `insert into app_public.categories (organization_id, name, is_default) values ($1, $2, $3) returning id`,
      [orgId, name, isDefault],
    );
    return rows[0].id as string;
  };
  return { user, org, other, add };
};

const defaults = async (client: PoolClient, orgId: string) => {
  const { rows } = await client.query(
    `select name from app_public.categories where organization_id = $1 and is_default`,
    [orgId],
  );
  return rows.map((r) => r.name);
};

describe("default category", () => {
  it("is off by default", () =>
    withRootDb(async (client) => {
      const { org, add } = await setup(client);
      await add(org.id, "A");
      expect(await defaults(client, org.id)).toEqual([]);
    }));

  it("takes it off the previous default, only in the same org", () =>
    withRootDb(async (client) => {
      const { user, org, other, add } = await setup(client);
      await add(org.id, "A", true);
      await add(other.id, "Other", true);
      const b = await add(org.id, "B");
      expect(await defaults(client, org.id)).toEqual(["A"]);

      await becomeUser(client, user.id);
      await client.query(
        `update app_public.categories set is_default = true where id = $1`,
        [b],
      );
      await becomeRoot(client);
      expect(await defaults(client, org.id)).toEqual(["B"]);
      expect(await defaults(client, other.id)).toEqual(["Other"]);

      // A new default on insert works the same
      await add(org.id, "C", true);
      expect(await defaults(client, org.id)).toEqual(["C"]);
    }));
});
