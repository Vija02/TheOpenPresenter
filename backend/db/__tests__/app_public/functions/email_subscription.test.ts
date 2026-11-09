import { PoolClient } from "pg";
import { describe, expect, it } from "vitest";

import {
  becomeRoot,
  becomeUser,
  createUsers,
  withRootDb,
  withUserDb,
} from "../../helpers";

const wantsEmail = async (client: PoolClient, userId: string) => {
  await becomeRoot(client);
  const {
    rows: [row],
  } = await client.query(
    "select app_private.user_wants_email($1, 'onboarding') as wants",
    [userId],
  );
  return row.wants as boolean;
};

const getToken = async (client: PoolClient, userId: string) => {
  await becomeRoot(client);
  const {
    rows: [row],
  } = await client.query(
    "select email_unsubscribe_token from app_private.user_secrets where user_id = $1",
    [userId],
  );
  return row.email_unsubscribe_token as string;
};

describe("email subscriptions", () => {
  it("is subscribed by default and gives each user their own token", () =>
    withRootDb(async (client) => {
      const [a, b] = await createUsers(client, 2);
      expect(await wantsEmail(client, a.id)).toBe(true);
      const tokenA = await getToken(client, a.id);
      const tokenB = await getToken(client, b.id);
      expect(tokenA).toMatch(/^[0-9a-f]{36}$/);
      expect(tokenA).not.toEqual(tokenB);
    }));

  it("lets a logged-in user unsubscribe and resubscribe", () =>
    withUserDb(async (client, user) => {
      const {
        rows: [row],
      } = await client.query(
        "select * from app_public.set_my_email_subscription('onboarding', false)",
      );
      expect(row).toMatchObject({
        user_id: user.id,
        category: "onboarding",
        subscribed: false,
      });
      expect(await wantsEmail(client, user.id)).toBe(false);

      await becomeUser(client, user.id);
      await client.query(
        "select app_public.set_my_email_subscription('onboarding', true)",
      );
      expect(await wantsEmail(client, user.id)).toBe(true);
    }));

  it("only shows a user their own preferences", () =>
    withRootDb(async (client) => {
      const [a, b] = await createUsers(client, 2);
      await becomeUser(client, a.id);
      await client.query(
        "select app_public.set_my_email_subscription('onboarding', false)",
      );
      await becomeUser(client, b.id);
      const { rows } = await client.query(
        "select * from app_public.user_email_preferences",
      );
      expect(rows).toHaveLength(0);
    }));

  it("unsubscribes from a link without logging in", () =>
    withRootDb(async (client) => {
      const [user] = await createUsers(client, 1);
      const token = await getToken(client, user.id);

      await becomeUser(client, null);
      const {
        rows: [row],
      } = await client.query(
        "select app_public.set_email_subscription_by_token($1, 'onboarding', false) as ok",
        [token],
      );
      expect(row.ok).toBe(true);
      expect(await wantsEmail(client, user.id)).toBe(false);
    }));

  it("rejects an unknown token without changing anything", () =>
    withRootDb(async (client) => {
      const [user] = await createUsers(client, 1);
      await becomeUser(client, null);
      const {
        rows: [row],
      } = await client.query(
        "select app_public.set_email_subscription_by_token('nope', 'onboarding', false) as ok",
      );
      expect(row.ok).toBe(false);
      expect(await wantsEmail(client, user.id)).toBe(true);
    }));

  it("doesn't let anonymous users write preferences directly", () =>
    withRootDb(async (client) => {
      const [user] = await createUsers(client, 1);
      await becomeUser(client, null);
      await expect(
        client.query(
          "insert into app_public.user_email_preferences (user_id, category, subscribed) values ($1, 'onboarding', false)",
          [user.id],
        ),
      ).rejects.toThrow(/permission denied/);
    }));
});
