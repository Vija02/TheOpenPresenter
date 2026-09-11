import { randomBytes } from "crypto";

export interface UploadLinkRow {
  id: string;
  organization_id: string;
  project_id: string;
  scene_id: string;
  plugin_id: string;
  token: string;
  label: string | null;
  max_attempts: number | null;
  attempt_count: number;
  current_upload_id: string | null;
  expires_at: Date | string | null;
  is_active: boolean;
}

export type UploadLinkRejection =
  | "not-found"
  | "revoked"
  | "expired"
  | "limit-reached";

export const UPLOAD_LINK_STATUS: Record<UploadLinkRejection, number> = {
  "not-found": 404,
  revoked: 403,
  expired: 403,
  "limit-reached": 403,
};

export const UPLOAD_LINK_MESSAGE: Record<UploadLinkRejection, string> = {
  "not-found": "This upload link doesn't exist.",
  revoked: "This upload link has been turned off.",
  expired: "This upload link has expired.",
  "limit-reached":
    "You've used all your attempts on this link. Ask whoever sent it for a new one.",
};

export type UploadLinkCheck =
  | { ok: true }
  | { ok: false; reason: UploadLinkRejection };

/** Whether a link may currently be used. */
export const checkUploadLink = (
  link: UploadLinkRow | null | undefined,
  now: Date = new Date(),
): UploadLinkCheck => {
  if (!link) return { ok: false, reason: "not-found" };
  if (!link.is_active) return { ok: false, reason: "revoked" };
  if (link.expires_at !== null && new Date(link.expires_at) <= now) {
    return { ok: false, reason: "expired" };
  }
  if (link.max_attempts !== null && link.attempt_count >= link.max_attempts) {
    return { ok: false, reason: "limit-reached" };
  }
  return { ok: true };
};

/** Attempts left, or null when the link is unlimited. */
export const attemptsRemaining = (link: UploadLinkRow): number | null =>
  link.max_attempts === null
    ? null
    : Math.max(0, link.max_attempts - link.attempt_count);

/** 18 random bytes as 24 URL-safe characters. */
export const generateUploadToken = (): string =>
  randomBytes(18).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
