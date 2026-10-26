import { PoolClient } from "pg";
import { describe, expect, it, test } from "vitest";

import { snapshotSafe, withRootDb } from "../../helpers";
import { login } from "./login.test";
import { reallyCreateUser } from "./really_create_user.test";

async function linkOrRegisterUser(
  client: PoolClient,
  userId: string | null,
  service: string | null,
  identifier: string | null,
  profile: { [key: string]: any } | null,
  authDetails: { [key: string]: any } | null,
) {
  const {
    rows: [row],
  } = await client.query(
    `select * from app_private.link_or_register_user($1, $2, $3, $4, $5)`,
    [
      userId,
      service,
      identifier,
      profile ? JSON.stringify(profile) : null,
      authDetails ? JSON.stringify(authDetails) : null,
    ],
  );
  return row;
}

describe("when account doesn't already exist", () => {
  it("can login with full oauth details", () =>
    withRootDb(async (client) => {
      const user = await linkOrRegisterUser(
        client,
        null,
        "github",
        "123456",
        {
          email: "github.user.123456@example.com",
          email_verified: true,
          name: "GitHub User123456",
          avatar_url: "http://example.com/avatar.jpg",
          username: "GHU123",
        },
        {},
      );
      expect(user).toBeTruthy();
      expect(user.username).toEqual("GHU123");
      expect(user.name).toEqual("GitHub User123456");
      expect(user.avatar_url).toEqual("http://example.com/avatar.jpg");
      expect(user.is_admin).toEqual(false);
      expect(user.is_verified).toEqual(true);
      expect(snapshotSafe(user)).toMatchInlineSnapshot(`
        {
          "avatar_url": "http://example.com/avatar.jpg",
          "created_at": "[DATE]",
          "id": "[ID]",
          "is_admin": false,
          "is_verified": true,
          "name": "GitHub User123456",
          "onboarding_data": {},
          "updated_at": "[DATE]",
          "username": "GHU123",
        }
      `);
    }));

  it("can login with minimal oauth details", () =>
    withRootDb(async (client) => {
      const user = await linkOrRegisterUser(
        client,
        null,
        "github",
        "123456",
        {
          email: "github.user.123456@example.com",
          email_verified: true,
        },
        {},
      );
      expect(user).toBeTruthy();
      expect(user.username).toMatch(/^user(?:[1-9][0-9]+)?$/);
      expect(user.name).toEqual(null);
      expect(user.avatar_url).toEqual(null);
      expect(user.is_admin).toEqual(false);
      expect(user.is_verified).toEqual(true);
    }));

  test("cannot register without email", () =>
    withRootDb(async (client) => {
      const promise = client.query(
        "SELECT * FROM app_private.link_or_register_user($1, $2, $3, $4, $5)",
        [
          null,
          "facebook",
          "123456",
          JSON.stringify({ email: null, firstName: "A", lastName: "B" }),
          JSON.stringify({}),
        ],
      );
      await expect(promise).rejects.toMatchInlineSnapshot(
        `[error: Email is required]`,
      );
      await expect(promise).rejects.toMatchObject({
        code: "MODAT",
      });
    }));

  it("cannot register with invalid email", () =>
    withRootDb(async (client) => {
      const promise = linkOrRegisterUser(
        client,
        null,
        "github",
        "123456",
        { email: "flibble" },
        {},
      );
      await expect(promise).rejects.toThrowErrorMatchingInlineSnapshot(
        `[error: new row for relation "user_emails" violates check constraint "user_emails_email_check"]`,
      );
      await expect(promise).rejects.toMatchObject({
        code: "23514",
      });
    }));
});

it("login with new oauth sharing email of existing account links accounts", () =>
  withRootDb(async (client) => {
    const sharedEmail = "existing@example.com";
    const existingUser = await linkOrRegisterUser(
      client,
      null,
      "github",
      "123456",
      {
        email: sharedEmail,
        email_verified: true,
      },
      {},
    );
    expect(existingUser).toBeTruthy();
    const linkedUser = await linkOrRegisterUser(
      client,
      null,
      "twitter",
      "654321",
      {
        email: sharedEmail,
        email_verified: true,
      },
      {},
    );
    expect(linkedUser).toBeTruthy();
    expect(existingUser.id).toEqual(linkedUser.id);
  }));

it("login with new oauth when logged in links accounts", () =>
  withRootDb(async (client) => {
    const githubUser = await linkOrRegisterUser(
      client,
      null,
      "github",
      "123456",
      {
        email: "github@example.com",
        email_verified: true,
      },
      {},
    );
    expect(githubUser).toBeTruthy();
    const twitterUser = await linkOrRegisterUser(
      client,
      githubUser.id,
      "twitter",
      "654321",
      {
        email: "twitter@example.com",
      },
      {},
    );
    expect(twitterUser).toBeTruthy();
    expect(twitterUser.id).toEqual(githubUser.id);
  }));
it("does not trust an oauth email the provider has not verified", () =>
  withRootDb(async (client) => {
    await linkOrRegisterUser(
      client,
      null,
      "github",
      "123456",
      { email: "shared@example.com", email_verified: true },
      {},
    );
    const otherUser = await linkOrRegisterUser(
      client,
      null,
      "google",
      "654321",
      { email: "unverified@example.com" },
      {},
    );
    expect(otherUser.is_verified).toEqual(false);

    const promise = linkOrRegisterUser(
      client,
      null,
      "google",
      "999999",
      { email: "shared@example.com", email_verified: false },
      {},
    );
    await expect(promise).rejects.toMatchObject({ code: "EMTKN" });
  }));

describe("when an unverified password account has the same email", () => {
  const EMAIL = "claimed@example.com";
  const PASSWORD = "!TestPassword!";

  it("claims the account and requires a password reset", () =>
    withRootDb(async (client) => {
      const existingUser = await reallyCreateUser(
        client,
        "claimed",
        EMAIL,
        null,
        null,
        PASSWORD,
      );
      await client.query(
        `insert into app_private.sessions (user_id) values ($1)`,
        [existingUser.id],
      );

      const user = await linkOrRegisterUser(
        client,
        null,
        "google",
        "123456",
        { email: EMAIL, email_verified: true },
        {},
      );
      expect(user.id).toEqual(existingUser.id);
      expect(user.is_verified).toEqual(true);

      const { rows: emails } = await client.query(
        `select email, is_verified, is_primary from app_public.user_emails where user_id = $1`,
        [existingUser.id],
      );
      expect(emails).toEqual([
        { email: EMAIL, is_verified: true, is_primary: true },
      ]);
      const {
        rows: [{ count }],
      } = await client.query(
        `select count(*)::int from app_private.sessions where user_id = $1`,
        [existingUser.id],
      );
      expect(count).toEqual(0);

      await expect(login(client, EMAIL, PASSWORD)).rejects.toMatchObject({
        code: "PWRST",
      });
    }));

  it("lets them sign in with a new password", () =>
    withRootDb(async (client) => {
      const existingUser = await reallyCreateUser(
        client,
        "claimed",
        EMAIL,
        null,
        null,
        PASSWORD,
      );
      await linkOrRegisterUser(
        client,
        null,
        "google",
        "123456",
        { email: EMAIL, email_verified: true },
        {},
      );
      await client.query(
        `update app_private.user_secrets set password_hash = crypt('!NewPassword!', gen_salt('bf')) where user_id = $1`,
        [existingUser.id],
      );
      const session = await login(client, EMAIL, "!NewPassword!");
      expect(session.user_id).toEqual(existingUser.id);
    }));

  it("refuses to claim an account that has another sign in method", () =>
    withRootDb(async (client) => {
      const existingUser = await reallyCreateUser(
        client,
        "claimed",
        EMAIL,
        null,
        null,
        PASSWORD,
      );
      await client.query(
        `insert into app_public.user_authentications (user_id, service, identifier, details) values ($1, 'github', 'gh', '{}')`,
        [existingUser.id],
      );
      const promise = linkOrRegisterUser(
        client,
        null,
        "google",
        "123456",
        { email: EMAIL, email_verified: true },
        {},
      );
      await expect(promise).rejects.toMatchObject({ code: "EMLNK" });
    }));
});

it("refuses to claim an account with another email", () =>
  withRootDb(async (client) => {
    const existingUser = await reallyCreateUser(
      client,
      "claimed",
      "claimed@example.com",
      null,
      null,
      "!TestPassword!",
    );
    await client.query(
      `insert into app_public.user_emails (user_id, email) values ($1, 'planted@example.com')`,
      [existingUser.id],
    );
    const promise = linkOrRegisterUser(
      client,
      null,
      "google",
      "123456",
      { email: "claimed@example.com", email_verified: true },
      {},
    );
    await expect(promise).rejects.toMatchObject({ code: "EMLNK" });
  }));

describe("when logged in to an unverified account", () => {
  it("cannot link a different email", () =>
    withRootDb(async (client) => {
      const user = await reallyCreateUser(
        client,
        "unverified",
        "unverified@example.com",
        null,
        null,
        "!TestPassword!",
      );
      const promise = linkOrRegisterUser(
        client,
        user.id,
        "google",
        "123456",
        { email: "other@example.com", email_verified: true },
        {},
      );
      await expect(promise).rejects.toMatchObject({ code: "VRFY3" });
    }));

  it("verifies the account when linking its own email", () =>
    withRootDb(async (client) => {
      const user = await reallyCreateUser(
        client,
        "unverified",
        "unverified@example.com",
        null,
        null,
        "!TestPassword!",
      );
      const linkedUser = await linkOrRegisterUser(
        client,
        user.id,
        "google",
        "123456",
        { email: "unverified@example.com", email_verified: true },
        {},
      );
      expect(linkedUser.id).toEqual(user.id);
      expect(linkedUser.is_verified).toEqual(true);
    }));
});
