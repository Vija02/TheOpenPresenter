import { logger } from "@repo/observability";

/**
 * Thin client over the Canva Connect REST API.
 *
 * https://www.canva.dev/docs/connect/api-reference/
 */

const CANVA_API_BASE = "https://api.canva.com/rest/v1";

export type CanvaDesign = {
  id: string;
  title?: string;
  page_count?: number;
  design_types?: string[];
  updated_at?: number;
  thumbnail?: { url: string; width: number; height: number };
};

export type CanvaDesignList = {
  items: CanvaDesign[];
  continuation?: string;
};

export class CanvaUserActionableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanvaUserActionableError";
  }
}

const canvaFetch = async <T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> => {
  const res = await fetch(`${CANVA_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body != null ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const text = await res.text();

  if (!res.ok) {
    let message = text;
    try {
      message = JSON.parse(text).message ?? text;
    } catch {
      // Non JSON body, use the raw text
    }
    if (res.status === 429) {
      throw new CanvaUserActionableError(
        "Canva is rate limiting this account. Please wait a few minutes and try again.",
      );
    }
    throw new Error(`Canva API ${path} failed (${res.status}): ${message}`);
  }

  return JSON.parse(text) as T;
};

export const listDesigns = (
  accessToken: string,
  {
    query,
    continuation,
    limit = 50,
  }: { query?: string; continuation?: string; limit?: number } = {},
): Promise<CanvaDesignList> => {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  if (continuation) params.set("continuation", continuation);
  params.set("limit", String(Math.min(Math.max(limit, 1), 100)));
  // Most recently edited first
  if (!query) params.set("sort_by", "modified_descending");

  return canvaFetch<CanvaDesignList>(
    accessToken,
    `/designs?${params.toString()}`,
  );
};

type ExportJob = {
  job: {
    id: string;
    status: "in_progress" | "success" | "failed";
    urls?: string[];
    error?: { code: string; message: string };
  };
};

const EXPORT_POLL_INTERVAL_MS = 1500;
const EXPORT_TIMEOUT_MS = 5 * 60 * 1000;

const describeExportError = (code: string, message: string): string => {
  switch (code) {
    case "license_required":
      return "This design uses Canva premium elements that haven't been purchased. Buy the elements in Canva, or remove them, then try again.";
    case "approval_required":
      return "This design needs reviewer approval in Canva before it can be exported.";
    default:
      return `Canva could not export this design: ${message}`;
  }
};

/**
 * Exports a design to PDF. Canva's export endpoint is an asynchronous job, so
 * this creates the job then polls until it settles.
 */
export const exportDesignAsPdf = async (
  accessToken: string,
  designId: string,
  log: typeof logger,
): Promise<Buffer> => {
  const created = await canvaFetch<ExportJob>(accessToken, "/exports", {
    method: "POST",
    body: JSON.stringify({
      design_id: designId,
      format: { type: "pdf" },
    }),
  });

  log.info({ designId, jobId: created.job.id }, "Canva export job created");

  let job = created.job;
  const startedAt = Date.now();
  let polls = 0;

  while (job.status === "in_progress") {
    if (Date.now() - startedAt > EXPORT_TIMEOUT_MS) {
      throw new Error(`Canva export job ${job.id} timed out`);
    }
    await new Promise((resolve) =>
      setTimeout(resolve, EXPORT_POLL_INTERVAL_MS),
    );
    const polled = await canvaFetch<ExportJob>(
      accessToken,
      `/exports/${job.id}`,
    );
    job = polled.job;
    polls += 1;
    log.trace(
      { jobId: job.id, status: job.status, polls },
      "Canva export job polled",
    );
  }

  if (job.status === "failed") {
    const code = job.error?.code ?? "unknown";
    const message = job.error?.message ?? "Unknown error";
    log.warn({ designId, code, message }, "Canva export job failed");
    throw new CanvaUserActionableError(describeExportError(code, message));
  }

  const url = job.urls?.[0];
  if (!url) {
    throw new Error("Canva export job succeeded but returned no download URL");
  }

  log.info({ jobId: job.id, polls }, "Canva export succeeded, downloading");
  const fileRes = await fetch(url);
  if (!fileRes.ok) {
    throw new Error(
      `Failed to download Canva export (${fileRes.status} ${fileRes.statusText})`,
    );
  }

  return Buffer.from(await fileRes.arrayBuffer());
};

export type CanvaAccountIdentity = {
  canvaUserId: string;
  canvaTeamId: string | null;
  displayName: string | null;
};

export const getAccountIdentity = async (
  accessToken: string,
  log: typeof logger,
): Promise<CanvaAccountIdentity> => {
  const me = await canvaFetch<{
    team_user: { user_id: string; team_id?: string };
  }>(accessToken, "/users/me");

  let displayName: string | null = null;
  try {
    const profile = await canvaFetch<{
      profile: { display_name?: string };
    }>(accessToken, "/users/me/profile");
    displayName = profile.profile?.display_name ?? null;
  } catch (err) {
    log.warn(
      { err },
      "Could not read Canva display name (is the profile:read scope enabled?)",
    );
  }

  return {
    canvaUserId: me.team_user.user_id,
    canvaTeamId: me.team_user.team_id ?? null,
    displayName,
  };
};
