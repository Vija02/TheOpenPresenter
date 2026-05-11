import { Express } from "express";
import { get } from "lodash";
import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

import { getWebsocketMiddlewares } from "../app";
import { cleanupScreenGuestSession } from "../api/screen/helpers";
import { getRootPgPool } from "./installDatabasePools";
import installPassportQRStrategy from "./installPassportQRStrategy";
import installPassportStrategy from "./installPassportStrategy";

interface DbSession {
  session_id: string;
}

export default async (app: Express) => {
  passport.serializeUser((sessionObject: DbSession, done) => {
    done(null, sessionObject.session_id);
  });

  passport.deserializeUser((session_id: string, done) => {
    done(null, { session_id });
  });

  const passportInitializeMiddleware = passport.initialize();
  app.use(passportInitializeMiddleware);
  getWebsocketMiddlewares(app).push(passportInitializeMiddleware);

  const passportSessionMiddleware = passport.session();
  app.use(passportSessionMiddleware);
  getWebsocketMiddlewares(app).push(passportSessionMiddleware);

  // Wrap logout so it logout guest session as well
  app.use((req, _res, next) => {
    const originalLogout = req.logout.bind(req);

    const wrappedLogout = (
      optionsOrCb?:
        | Parameters<Express.Request["logout"]>[0]
        | ((err?: Error) => void),
      maybeCb?: (err?: Error) => void,
    ): void => {
      const cb = typeof optionsOrCb === "function" ? optionsOrCb : maybeCb;
      const options =
        typeof optionsOrCb === "function" ? undefined : optionsOrCb;

      const cleanup = async () => {
        const guestSessionId = req.session?.screenGuestSession?.id;
        if (!guestSessionId) return;
        try {
          await cleanupScreenGuestSession(getRootPgPool(app), guestSessionId);
        } catch {
          // best-effort: don't block logout on cleanup failure
        }
        if (req.session) {
          req.session.screenGuestSession = undefined;
        }
      };

      cleanup().finally(() => {
        if (options !== undefined) {
          originalLogout(options, (err) => cb?.(err));
        } else {
          originalLogout((err) => cb?.(err));
        }
      });
    };

    req.logout = wrappedLogout as Express.Request["logout"];
    next();
  });

  app.get("/logout", (req, res) => {
    req.logout(() => {
      res.redirect(req.query.next?.toString() ?? "/");
    });
  });

  installPassportQRStrategy(app);

  if (process.env.GITHUB_KEY) {
    await installPassportStrategy(
      app,
      "github",
      GitHubStrategy,
      {
        clientID: process.env.GITHUB_KEY,
        clientSecret: process.env.GITHUB_SECRET,
        scope: ["user:email"],
      },
      {},
      async (profile, _accessToken, _refreshToken, _extra, _req) => ({
        id: profile.id,
        displayName: profile.displayName || "",
        username: profile.username,
        avatarUrl: get(profile, "photos.0.value"),
        email: profile.email || get(profile, "emails.0.value"),
      }),
      ["token", "tokenSecret"],
    );
  }
  if (process.env.GOOGLE_CLIENT_ID) {
    await installPassportStrategy(
      app,
      "google",
      GoogleStrategy,
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        scope: ["profile", "email"],
      },
      {},
      async (profile, _accessToken, _refreshToken, _extra, _req) => {
        return {
          id: profile.id,
          displayName: profile.displayName || "",
          username: get(profile, "name.givenName"),
          avatarUrl: get(profile, "photos.0.value"),
          email: profile.email || get(profile, "emails.0.value"),
        };
      },
      ["token", "tokenSecret"],
    );
  }
};
