import crypto from "crypto";
import { Express } from "express";
import fs from "fs";
import helmet, { HelmetOptions } from "helmet";
import path from "path";

import { serverPluginApi } from "../pluginManager";
import { DEV_NONCE } from "./shared";

const { contentSecurityPolicy } = helmet;

const tmpRootUrl = process.env.ROOT_URL;

if (!tmpRootUrl || typeof tmpRootUrl !== "string") {
  throw new Error("Envvar ROOT_URL is required.");
}
const ROOT_URL = tmpRootUrl;

const isDevOrTest =
  process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

export default async function installHelmet(app: Express) {
  const registeredCSPDirectives = serverPluginApi.getRegisteredCSPDirectives();

  const getOptions = (nonce: string, devMode: boolean = false) => {
    const defaultDirectives = Object.fromEntries(
      Object.entries({
        ...contentSecurityPolicy.getDefaultDirectives(),
        "connect-src": [
          "'self'",
          // Safari doesn't allow using wss:// origins as 'self' from
          // an https:// page, so we have to translate explicitly for
          // it.
          ROOT_URL.replace(/^http/, "ws"),
          // For tauri
          "ipc:",
        ],
        "script-src": [
          ...(contentSecurityPolicy.getDefaultDirectives()[
            "script-src"
          ] as Iterable<any>),
          // ES Module shim
          "https://ga.jspm.io",
          "https://esm.sh",
          // Nonce for general usage
          `'nonce-${nonce}'`,
          "blob:",
        ],
        "media-src": ["*"],
        "img-src": ["*"],
      }).filter(
        process.env.DISABLE_HSTS
          ? ([key]) => key !== "upgrade-insecure-requests"
          : () => true,
      ),
    );

    const options: HelmetOptions = {
      contentSecurityPolicy: {
        useDefaults: false,
        directives: registeredCSPDirectives.reduce(
          (acc, val) => mergeConfig(acc, val.cspDirective),
          defaultDirectives as Record<string, any>,
        ),
      },
      // Useful for OAuth
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    };

    if (isDevOrTest || devMode) {
      // Appease TypeScript
      if (
        typeof options.contentSecurityPolicy === "boolean" ||
        !options.contentSecurityPolicy
      ) {
        throw new Error(`contentSecurityPolicy must be an object`);
      }
      options.contentSecurityPolicy.directives!["connect-src"] = [
        ...(options.contentSecurityPolicy.directives![
          "connect-src"
        ] as Iterable<any>),
        // For Vite
        "ws://localhost:*",
        "http://localhost:*",
      ];
      options.contentSecurityPolicy.directives!["script-src"] = [
        ...(options.contentSecurityPolicy.directives![
          "script-src"
        ] as Iterable<any>),
        // Dev needs 'unsafe-eval' due to
        // https://github.com/vercel/next.js/issues/14221
        "'unsafe-eval'",
        // For Vite
        "'unsafe-inline'",
        // Don't use nonce on dev since we're using unsafe inline. This is also used by React dev tools
      ].filter((x) => !x.startsWith("'nonce"));
    }
    if (isDevOrTest || !!process.env.ENABLE_GRAPHIQL) {
      // Enables prettier script and SVG icon in GraphiQL
      options.crossOriginEmbedderPolicy = false;
    }
    if (process.env.DISABLE_HSTS) {
      options.strictTransportSecurity = false;
    }

    return options;
  };

  app.use((req, res, next) => {
    const nonce =
      process.env.NODE_ENV === "development" ? DEV_NONCE : crypto.randomUUID();
    res.locals.nonce = nonce;

    return helmet(getOptions(nonce, hack__shouldBypass(req.url)))(
      req,
      res,
      next,
    );
  });
}

// DEBT: We use unsafe-inline for homepage because next.js uses it
// This is something that is not possible in next.js right now for app pages
// https://github.com/vercel/next.js/discussions/54907
const homepathPath = path.join(__dirname, "../../../", "apps/homepage");
let homepageAppDirContents: fs.Dirent[] = [];
try {
  // Dev
  homepageAppDirContents = fs.readdirSync(
    path.join(homepathPath, "src/app/(default)"),
    {
      withFileTypes: true,
    },
  );
} catch {}
try {
  // For prod
  homepageAppDirContents = fs.readdirSync(
    path.join(homepathPath, ".next/server/app/(default)"),
    {
      withFileTypes: true,
    },
  );
} catch {}
const listOfPages = homepageAppDirContents
  .filter((x) => x.isDirectory())
  .map((x) => `/${x.name}`);
const hack__shouldBypass = (url: string) => {
  return url === "/" || listOfPages.some((x) => x.startsWith(url));
};

function mergeConfigRecursively(
  defaults: Record<string, any>,
  overrides: Record<string, any>,
  rootPath: string,
) {
  const merged: Record<string, any> = { ...defaults };
  for (const key in overrides) {
    const value = overrides[key];
    if (value == null) {
      continue;
    }

    const existing = merged[key];

    if (existing == null) {
      merged[key] = value;
      continue;
    }

    if (Array.isArray(existing) || Array.isArray(value)) {
      merged[key] = [...arraify(existing), ...arraify(value)];
      continue;
    }
    if (isObject(existing) && isObject(value)) {
      merged[key] = mergeConfigRecursively(
        existing,
        value,
        rootPath ? `${rootPath}.${key}` : key,
      );
      continue;
    }

    merged[key] = value;
  }
  return merged;
}

export function mergeConfig<
  D extends Record<string, any>,
  O extends Record<string, any>,
>(
  defaults: D extends Function ? never : D,
  overrides: O extends Function ? never : O,
  isRoot = true,
): Record<string, any> {
  if (typeof defaults === "function" || typeof overrides === "function") {
    throw new Error(`Cannot merge config in form of callback`);
  }

  return mergeConfigRecursively(defaults, overrides, isRoot ? "" : ".");
}

export function arraify<T>(target: T | T[]): T[] {
  return Array.isArray(target) ? target : [target];
}
export function isObject(value: unknown): value is Record<string, any> {
  return Object.prototype.toString.call(value) === "[object Object]";
}
