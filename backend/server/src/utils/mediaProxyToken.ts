import crypto from "crypto";

/**
 * Self-contained, authenticated tokens for the media proxy.
 *
 * A self-hosted/desktop (tauri) device whose ROOT_URL is a private LAN address
 * can't hand Microsoft Office Online a directly-fetchable URL. Instead it asks
 * our cloud to proxy the file through an iroh/dumbpipe tunnel. The cloud has no
 * org/session context for that request (Office fetches anonymously), so the
 * device's iroh ticket + the target media name travel *inside* this token.
 *
 * We use AES-256-GCM (authenticated encryption) rather than a plain signature
 * so the ticket stays opaque in the URL/logs in addition to being unforgeable.
 * Signing and verifying both happen on the cloud, so the key is derived from
 * the cloud's existing `SECRET` (domain-separated) — no secret ships in the
 * distributed clients.
 */

const ALGO = "aes-256-gcm";
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface MediaProxyClaims {
  ticket: string;
  mediaName: string;
  exp: number; // epoch ms
}

function getKey(): Buffer | null {
  const secret = process.env.SECRET;
  if (!secret) return null;
  return crypto
    .createHash("sha256")
    .update("media-proxy-token\0")
    .update(secret)
    .digest();
}

const b64url = (b: Buffer) => b.toString("base64url");
const fromB64url = (s: string) => Buffer.from(s, "base64url");

export function signMediaProxyToken(
  data: { ticket: string; mediaName: string },
  ttlMs: number = DEFAULT_TTL_MS,
  now: number = Date.now(),
): string {
  const key = getKey();
  if (!key) {
    throw new Error("SECRET is not configured");
  }

  const claims: MediaProxyClaims = {
    ticket: data.ticket,
    mediaName: data.mediaName,
    exp: now + ttlMs,
  };

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(claims), "utf8")),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [b64url(iv), b64url(enc), b64url(tag)].join(".");
}

/** Returns the claims if the token is valid and unexpired, otherwise null */
export function verifyMediaProxyToken(
  token: string,
  now: number = Date.now(),
): MediaProxyClaims | null {
  const key = getKey();
  if (!key) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [ivB, encB, tagB] = parts as [string, string, string];

    const decipher = crypto.createDecipheriv(ALGO, key, fromB64url(ivB));
    decipher.setAuthTag(fromB64url(tagB));
    const dec = Buffer.concat([
      decipher.update(fromB64url(encB)),
      decipher.final(),
    ]);

    const claims = JSON.parse(dec.toString("utf8")) as MediaProxyClaims;
    if (
      typeof claims.exp !== "number" ||
      typeof claims.ticket !== "string" ||
      typeof claims.mediaName !== "string"
    ) {
      return null;
    }
    if (claims.exp < now) return null;
    return claims;
  } catch {
    // Bad auth tag, malformed token, etc.
    return null;
  }
}
