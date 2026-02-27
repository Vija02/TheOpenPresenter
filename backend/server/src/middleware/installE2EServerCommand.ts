import { urlencoded } from "body-parser";
import { Express, Request, RequestHandler, Response } from "express";
import { Pool } from "pg";

import {
  DEFAULT_MOCK_HOST_CONFIG,
  clearAllActiveDevices,
  getMockHostDeviceStatus,
  startMockHostDevice,
  stopMockHostDevice,
  syncMockHostDevice,
} from "../utils/mockHostDevice";
import { createSessionCookie } from "../utils/sessionCookie";
import { getRootPgPool } from "./installDatabasePools";

export default (app: Express) => {
  // Only enable this in test/development mode
  if (!["test", "development"].includes(process.env.NODE_ENV || "")) {
    throw new Error("This code must not run in production");
  }

  /*
   * Furthermore we require the `ENABLE_E2E_COMMANDS` environmental variable
   * to be set; this gives us extra protection against accidental XSS/CSRF
   * attacks.
   */
  const safeToRun = process.env.ENABLE_E2E_COMMANDS === "1";

  const rootPgPool = getRootPgPool(app);

  /*
   * This function is invoked for the /E2EServerCommand route and is
   * responsible for parsing the request and handing it off to the relevant
   * function.
   */
  const handleE2EServerCommand: RequestHandler = async (req, res, next) => {
    /*
     * If we didn't set ENABLE_E2E_COMMANDS, output a warning to the server
     * log, and then pretend the /E2EServerCommand route doesn't exist.
     */
    if (!safeToRun) {
      console.error(
        "/E2EServerCommand denied because ENABLE_E2E_COMMANDS is not set.",
      );
      // Pretend like nothing happened
      next();
      return;
    }

    try {
      // Try to read and parse the commands from the request.
      const { query } = req;
      if (!query) {
        throw new Error("Query not specified");
      }

      const { command: rawCommand, payload: rawPayload } = query;
      if (!rawCommand) {
        throw new Error("Command not specified");
      }

      const command = String(rawCommand);
      const payload = rawPayload ? JSON.parse(String(rawPayload)) : {};

      // Now run the actual command:
      const result = await runCommand(req, res, rootPgPool, command, payload);

      if (result === null) {
        /*
         * When a command returns null, we assume they've handled sending the
         * response. This allows commands to do things like redirect to new
         * pages when they're done.
         */
      } else {
        /*
         * The command returned a result, send it back to the test suite.
         */
        res.json(result);
      }
    } catch (e: any) {
      /*
       * If anything goes wrong, let the test runner know so that it can fail
       * the test.
       */
      console.error("E2EServerCommand failed!");
      console.error(e);
      res.status(500).json({
        error: {
          message: e.message,
          stack: e.stack,
        },
      });
    }
  };
  app.get(
    "/E2EServerCommand",
    urlencoded({ extended: false }),
    handleE2EServerCommand,
  );
};

async function runCommand(
  req: Request,
  res: Response,
  rootPgPool: Pool,
  command: string,
  payload: { [key: string]: any },
): Promise<object | null> {
  if (command === "clearTestUsers") {
    await rootPgPool.query(
      "delete from app_public.users where username like 'testuser%'",
    );
    return { success: true };
  } else if (command === "clearTestOrganizations") {
    await rootPgPool.query(
      "delete from app_public.organizations where slug like 'test%'",
    );
    return { success: true };
  } else if (command === "createUser") {
    if (!payload) {
      throw new Error("Payload required");
    }
    const {
      username = "testuser",
      email = `${username}@example.com`,
      verified = false,
      name = username,
      avatarUrl = null,
      password = "TestUserPassword",
    } = payload;
    if (!username.startsWith("testuser")) {
      throw new Error("Test user usernames may only start with 'testuser'");
    }
    const user = await reallyCreateUser(rootPgPool, {
      username,
      email,
      verified,
      name,
      avatarUrl,
      password,
    });

    let verificationToken: string | null = null;
    const userEmailSecrets = await getUserEmailSecrets(rootPgPool, email);
    const userEmailId: string = userEmailSecrets.user_email_id;
    if (!verified) {
      verificationToken = userEmailSecrets.verification_token;
    }

    return { user, userEmailId, verificationToken };
  } else if (command === "login") {
    const {
      username = "testuser",
      email = `${username}@example.com`,
      verified = false,
      name = username,
      avatarUrl = null,
      password = "TestUserPassword",
      next = "/",
      orgs = [],
    } = payload;
    const user = await reallyCreateUser(rootPgPool, {
      username,
      email,
      verified,
      name,
      avatarUrl,
      password,
    });
    const otherUser = await reallyCreateUser(rootPgPool, {
      username: "testuser_other",
      email: "testuser_other@example.com",
      name: "testuser_other",
      verified: true,
      password: "DOESNT MATTER",
    });
    const session = await createSession(rootPgPool, user.id);
    const otherSession = await createSession(rootPgPool, otherUser.id);

    const client = await rootPgPool.connect();
    try {
      await client.query("begin");
      async function setSession(sess: any) {
        await client.query(
          "select set_config('jwt.claims.session_id', $1, true)",
          [sess.uuid],
        );
      }
      try {
        await setSession(session);
        await Promise.all(
          orgs.map(
            async ({
              name,
              slug,
              projects = [],
              owner = true,
            }: {
              name: string;
              slug: string;
              projects?: { name: string; slug: string }[];
              owner?: boolean;
            }) => {
              if (!owner) {
                await setSession(otherSession);
              }
              const {
                rows: [organization],
              } = await client.query(
                "select * from app_public.create_organization($1, $2)",
                [slug, name],
              );
              if (!owner) {
                await client.query(
                  "select app_public.invite_to_organization($1::uuid, $2::citext, null::citext)",
                  [organization.id, user.username],
                );
                await setSession(session);
                await client.query(
                  `select app_public.accept_invitation_to_organization(organization_invitations.id)
                   from app_public.organization_invitations
                   where user_id = $1`,
                  [user.id],
                );
              }

              for (const project of projects) {
                await client.query(
                  `
                  select app_public.create_full_project($1, $2, $3, $4);
                `,
                  [organization.id, project.name, project.slug, []],
                );
              }
            },
          ),
        );
      } finally {
        await client.query("commit");
      }
    } finally {
      await client.release();
    }

    req.login({ session_id: session.uuid }, () => {
      setTimeout(() => {
        // This 500ms delay is required to keep GitHub actions happy. 200ms wasn't enough.
        res.redirect(next || "/");
      }, 500);
    });
    return null;
  } else if (command === "getEmailSecrets") {
    const { email = "testuser@example.com" } = payload;
    const userEmailSecrets = await getUserEmailSecrets(rootPgPool, email);
    return userEmailSecrets;
  } else if (command === "verifyUser") {
    const { username = "testuser" } = payload;
    await rootPgPool.query(
      "update app_public.users SET is_verified = TRUE where username = $1",
      [username],
    );
    return { success: true };
  } else if (command === "startMockHostDevice") {
    const { serverHost, serverPort } = payload || {};
    const config = {
      serverHost: serverHost ?? DEFAULT_MOCK_HOST_CONFIG.serverHost,
      serverPort: serverPort ?? DEFAULT_MOCK_HOST_CONFIG.serverPort,
    };
    const { irohEndpointId, irohTicket } = await startMockHostDevice(config);
    return { success: true, irohEndpointId, irohTicket };
  } else if (command === "stopMockHostDevice") {
    const { serverHost, serverPort } = payload || {};
    const config = {
      serverHost: serverHost ?? DEFAULT_MOCK_HOST_CONFIG.serverHost,
      serverPort: serverPort ?? DEFAULT_MOCK_HOST_CONFIG.serverPort,
    };
    await stopMockHostDevice(config);
    return { success: true };
  } else if (command === "syncMockHostDevice") {
    const { serverHost, serverPort } = payload || {};
    const config = {
      serverHost: serverHost ?? DEFAULT_MOCK_HOST_CONFIG.serverHost,
      serverPort: serverPort ?? DEFAULT_MOCK_HOST_CONFIG.serverPort,
    };
    await syncMockHostDevice(config);
    return { success: true };
  } else if (command === "getMockHostDeviceStatus") {
    return getMockHostDeviceStatus();
  } else if (command === "createCloudConnection") {
    // Create a cloud connection for E2E testing (localhost only)
    const { organizationSlug, targetOrganizationSlug } = payload;

    if (!organizationSlug || !targetOrganizationSlug) {
      throw new Error(
        "organizationSlug and targetOrganizationSlug are required",
      );
    }

    // Get organization ID and target organization's owner user ID
    const {
      rows: [result],
    } = await rootPgPool.query(
      `SELECT 
         o.id AS org_id,
         om.user_id AS target_owner_user_id
       FROM app_public.organizations o
       CROSS JOIN app_public.organizations target_o
       JOIN app_public.organization_memberships om ON om.organization_id = target_o.id AND om.is_owner = true
       WHERE o.slug = $1 AND target_o.slug = $2
       LIMIT 1`,
      [organizationSlug, targetOrganizationSlug],
    );

    if (!result?.org_id) {
      throw new Error(`Organization not found: ${organizationSlug}`);
    }

    if (!result?.target_owner_user_id) {
      throw new Error(
        `Could not find owner for target organization: ${targetOrganizationSlug}`,
      );
    }

    // Create a session cookie for the target org's owner
    const sessionCookie = await createSessionCookie(
      req.app as Express,
      rootPgPool,
      {
        userId: result.target_owner_user_id,
      },
    );

    if (!sessionCookie) {
      throw new Error("Failed to create session cookie");
    }

    // Insert cloud connection (localhost only for E2E testing)
    const {
      rows: [connection],
    } = await rootPgPool.query(
      `INSERT INTO app_public.cloud_connections 
       (organization_id, host, session_cookie, session_cookie_expiry, target_organization_slug, creator_user_id)
       VALUES ($1, $2, $3, NOW() + INTERVAL '1 day', $4, $5)
       RETURNING id`,
      [
        result.org_id,
        "http://localhost:5678",
        sessionCookie,
        targetOrganizationSlug,
        result.target_owner_user_id,
      ],
    );

    return { success: true, connectionId: connection.id };
  } else if (command === "deleteCloudConnections") {
    // Delete cloud connections for an organization
    const { organizationSlug } = payload;

    if (!organizationSlug) {
      throw new Error("organizationSlug is required");
    }

    await rootPgPool.query(
      `DELETE FROM app_public.cloud_connections
       WHERE organization_id = (SELECT id FROM app_public.organizations WHERE slug = $1)`,
      [organizationSlug],
    );

    return { success: true };
  } else if (command === "clearAllActiveDevices") {
    await clearAllActiveDevices(req.app);
    return { success: true };
  } else {
    throw new Error(`Command '${command}' not understood.`);
  }
}

async function reallyCreateUser(
  rootPgPool: Pool,
  {
    username,
    email,
    verified,
    name,
    avatarUrl,
    password,
  }: {
    username?: string;
    email?: string;
    verified?: boolean;
    name?: string;
    avatarUrl?: string;
    password?: string;
  },
) {
  const {
    rows: [user],
  } = await rootPgPool.query(
    `SELECT * FROM app_private.really_create_user(
        username := $1,
        email := $2,
        email_is_verified := $3,
        name := $4,
        avatar_url := $5,
        password := $6
      )`,
    [username, email, verified, name, avatarUrl, password],
  );
  return user;
}

async function createSession(rootPgPool: Pool, userId: string) {
  const {
    rows: [session],
  } = await rootPgPool.query(
    `
      insert into app_private.sessions (user_id)
      values ($1)
      returning *
    `,
    [userId],
  );
  return session;
}

async function getUserEmailSecrets(rootPgPool: Pool, email: string) {
  const {
    rows: [userEmailSecrets],
  } = await rootPgPool.query(
    `
      select *
      from app_private.user_email_secrets
      where user_email_id = (
        select id
        from app_public.user_emails
        where email = $1
        order by id desc
        limit 1
      )
    `,
    [email],
  );
  return userEmailSecrets;
}
