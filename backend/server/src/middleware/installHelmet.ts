import { Express } from "express";
import helmet, { HelmetOptions } from "helmet";

const { contentSecurityPolicy } = helmet;

const tmpRootUrl = process.env.ROOT_URL;

if (!tmpRootUrl || typeof tmpRootUrl !== "string") {
  throw new Error("Envvar ROOT_URL is required.");
}
const ROOT_URL = tmpRootUrl;

const isDevOrTest =
  process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

export default async function installHelmet(app: Express) {
  const defaultScriptSrc = ["'self'", "https://ga.jspm.io", "blob:"];

  const options: HelmetOptions = {
    contentSecurityPolicy: {
      directives: {
        ...contentSecurityPolicy.getDefaultDirectives(),
        "connect-src": [
          "'self'",
          // Safari doesn't allow using wss:// origins as 'self' from
          // an https:// page, so we have to translate explicitly for
          // it.
          ROOT_URL.replace(/^http/, "ws"),
        ],
        "script-src": defaultScriptSrc,
      },
    },
  };
  if (isDevOrTest) {
    // Appease TypeScript
    if (
      typeof options.contentSecurityPolicy === "boolean" ||
      !options.contentSecurityPolicy
    ) {
      throw new Error(`contentSecurityPolicy must be an object`);
    }
    options.contentSecurityPolicy.directives!["connect-src"] = [
      "'self'",
      ROOT_URL.replace(/^http/, "ws"),
      // For Vite
      "ws://localhost:*",
      "http://localhost:*",
    ];
    // Dev needs 'unsafe-eval' due to
    // https://github.com/vercel/next.js/issues/14221
    options.contentSecurityPolicy.directives!["script-src"] = [
      ...defaultScriptSrc,
      "'unsafe-eval'",
      // For Vite
      "'unsafe-inline'",
    ];
  }
  if (isDevOrTest || !!process.env.ENABLE_GRAPHIQL) {
    // Enables prettier script and SVG icon in GraphiQL
    options.crossOriginEmbedderPolicy = false;
  }
  app.use(helmet(options));
}
