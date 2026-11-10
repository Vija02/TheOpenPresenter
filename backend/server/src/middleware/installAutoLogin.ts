import { Express, RequestHandler } from "express";

import { getWebsocketMiddlewares } from "../app";
import { getRootPgPool } from "./installDatabasePools";

const defaultUsername = "autologin";
const defaultPassword = "autologin_password";
const defaultEmail = "autologin@theopenpresenter.com";

let creating: Promise<void> | null = null;

/** The auto-login user and its organization, on a fresh database. */
async function createAutoLoginUser(
  rootPgPool: ReturnType<typeof getRootPgPool>,
): Promise<void> {
  const client = await rootPgPool.connect();
  try {
    await client.query("begin");
    const {
      rows: [user],
    } = await client.query<{ id: string }>(
      `select users.id from app_private.really_create_user(
        username => $1,
        email => $2,
        email_is_verified => false,
        name => $3,
        avatar_url => $4,
        password => $5
      ) users where not (users is null)`,
      [defaultUsername, defaultEmail, "Anonymous", null, defaultPassword],
    );
    const {
      rows: [org],
    } = await client.query<{ id: string }>(
      `insert into app_public.organizations (slug, name, organization_type) values ($1, $2, $3) returning id`,
      ["local", "Local", "church"],
    );
    await client.query(
      `insert into app_public.organization_memberships (organization_id, user_id, is_owner, is_billing_contact)
        values($1, $2, $3, $4)`,
      [org!.id, user!.id, true, true],
    );
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    // Created meanwhile by another server process: nothing left to do.
    if ((err as { code?: string }).code !== "23505") throw err;
  } finally {
    client.release();
  }
}

export default (app: Express) => {
  if (process.env.AUTO_LOGIN === "1") {
    const autoLoginMiddleware: RequestHandler = (req, res, next) => {
      autoLogin(req, res, next).catch(next);
    };
    const autoLogin = async (
      req: Parameters<RequestHandler>[0],
      _res: Parameters<RequestHandler>[1],
      next: Parameters<RequestHandler>[2],
    ) => {
      const login = (user: any) =>
        new Promise<void>((resolve, reject) => {
          req.login(user, { session: true, keepSessionInfo: true }, (err) =>
            err ? reject(err) : resolve(),
          );
        });

      const rootPgPool = getRootPgPool(app);

      if (!req.user?.session_id) {
        const findSession = async () => {
          const {
            rows: [session],
          } = await rootPgPool.query(
            `select sessions.* from app_private.login($1, $2) sessions where not (sessions is null)`,
            [defaultUsername, defaultPassword],
          );
          return session;
        };

        let session = await findSession();
        if (!session) {
          // Requests arrive together on a fresh database; only one creates.
          creating ??= createAutoLoginUser(rootPgPool).finally(() => {
            creating = null;
          });
          await creating;
          session = await findSession();
        }

        if (session?.uuid) {
          await login({ session_id: session.uuid });
        }
      }

      next();
    };

    app.use(autoLoginMiddleware);
    getWebsocketMiddlewares(app).push(autoLoginMiddleware);
  }
};
