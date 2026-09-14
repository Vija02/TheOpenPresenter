import { logger } from "@repo/observability";

const PCO_BASE =
  process.env.PLUGIN_LYRICS_PCO_API_URL ??
  "https://api.planningcenteronline.com";

export type JsonApiResource = {
  id: string;
  type: string;
  attributes: Record<string, any>;
  relationships?: Record<string, { data?: { id: string; type: string } }>;
};

type JsonApiDoc = {
  data: JsonApiResource | JsonApiResource[] | null;
  included?: JsonApiResource[];
  meta?: Record<string, any>;
};

export class PcoApiError extends Error {
  public readonly status: number;
  public readonly description: string | null;

  constructor(status: number, message: string, description?: string | null) {
    super(message);
    this.name = "PcoApiError";
    this.status = status;
    this.description = description ?? null;
  }
}

/**
 * A 403 from Planning Center means the authorizing person cannot reach the
 * Services product at all, which no amount of retrying fixes.
 */
export class PcoNoServicesAccessError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "PcoNoServicesAccessError";
  }
}

/** A single GET against the Services API */
export const pcoGet = async (
  accessToken: string,
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<JsonApiDoc> => {
  const url = new URL(path, PCO_BASE);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "TheOpenPresenter",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();

    // PCO nests the useful explanation in errors[0].meta.description
    let detail = "";
    let description = "";
    try {
      const parsed = JSON.parse(text);
      const first = parsed?.errors?.[0];
      detail = first?.detail ?? "";
      description = first?.meta?.description ?? "";
    } catch {
      // Non JSON error body, fall back to the raw text
    }

    logger.error(
      { status: res.status, path, description, scope: "pcoApi", body: text },
      "Planning Center API request failed",
    );

    if (res.status === 403) {
      throw new PcoNoServicesAccessError(
        description || detail || "You do not have access to this resource",
      );
    }

    throw new PcoApiError(
      res.status,
      `Planning Center request failed (${res.status}): ${text.slice(0, 500)}`,
      description,
    );
  }

  const doc = (await res.json()) as JsonApiDoc;
  return doc;
};

export const asArray = (doc: JsonApiDoc): JsonApiResource[] =>
  Array.isArray(doc.data) ? doc.data : doc.data ? [doc.data] : [];

export const asOne = (doc: JsonApiDoc): JsonApiResource | null =>
  Array.isArray(doc.data) ? (doc.data[0] ?? null) : doc.data;
