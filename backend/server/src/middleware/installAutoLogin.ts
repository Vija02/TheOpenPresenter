import { Express } from "express";

import { getRootPgPool } from "./installDatabasePools";

const defaultUsername = "autologin";
const defaultPassword = "autologin_password";
const defaultEmail = "autologin@theopenpresenter.com";

export default (app: Express) => {
  if (process.env.AUTO_LOGIN === "1") {
    app.use(async (req, _res, next) => {
      const login = (user: any) =>
        new Promise<void>((resolve, reject) => {
          req.login(user, (err) => (err ? reject(err) : resolve()));
        });

      const rootPgPool = getRootPgPool(app);

      if (!req.user?.session_id) {
        const {
          rows: [session],
        } = await rootPgPool.query(
          `select sessions.* from app_private.login($1, $2) sessions where not (sessions is null)`,
          [defaultUsername, defaultPassword],
        );

        // If doesn't exist, register and return
        if (!session) {
          const {
            rows: [details],
          } = await rootPgPool.query<{ user_id: number; session_id: string }>(
            `
            with new_user as (
              select users.* from app_private.really_create_user(
                username => $1,
                email => $2,
                email_is_verified => false,
                name => $3,
                avatar_url => $4,
                password => $5
              ) users where not (users is null)
            ), new_session as (
              insert into app_private.sessions (user_id)
              select id from new_user
              returning *
            )
            select new_user.id as user_id, new_session.uuid as session_id
            from new_user, new_session`,
            [defaultUsername, defaultEmail, "Anonymous", null, defaultPassword],
          );

          await login({ session_id: details?.session_id });
          next();
          return;
        }

        // If logged in, then continue
        if (session.uuid) {
          await login({ session_id: session.uuid });
        }
      }

      next();
    });
  }
};
