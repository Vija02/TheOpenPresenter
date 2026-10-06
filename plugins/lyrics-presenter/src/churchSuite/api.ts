import { CsListResponse, csGet } from "./client";

export type CsAccountInfo = {
  name: string | null;
  subdomain: string | null;
};

export const getAccountInfo = async (
  accessToken: string,
): Promise<CsAccountInfo> => {
  const { data } = await csGet<{
    data: { name?: string; subdomain?: string };
  }>(accessToken, "/account/info");

  return { name: data?.name ?? null, subdomain: data?.subdomain ?? null };
};

export type CsPlan = {
  id: string;
  name: string;
  /** "2024-01-24" */
  date: string;
  /** "10:30:00" */
  time: string | null;
  status: "draft" | "published";
};

type RawPlan = {
  id: number;
  name?: string;
  date: string;
  time?: string | null;
  status: "draft" | "published";
};

/**
 * Plans in a date window. ChurchSuite only filters on one status at a time,
 * and worship teams often leave next week's plan as a draft, so the caller
 * asks for both.
 */
export const listPlans = async (
  accessToken: string,
  {
    status,
    startsAfter,
    startsBefore,
    perPage,
  }: {
    status: CsPlan["status"];
    startsAfter: string;
    startsBefore: string;
    perPage: number;
  },
): Promise<CsPlan[]> => {
  const { data } = await csGet<CsListResponse<RawPlan>>(
    accessToken,
    "/planning/plans",
    {
      status,
      starts_after: startsAfter,
      starts_before: startsBefore,
      per_page: perPage,
      order_by: "date:asc",
    },
  );

  return (data ?? []).map((plan) => ({
    id: String(plan.id),
    name: plan.name || "Untitled plan",
    date: plan.date,
    time: plan.time ?? null,
    status: plan.status,
  }));
};

export type CsPlanItem = {
  id: string;
  planId: string;
  name: string;
  arrangementId: string | null;
  /** The key this plan uses, which can differ from the arrangement's */
  key: string | null;
  order: number;
};

type RawPlanItem = {
  id: number;
  type: "item" | "song";
  name?: string;
  plan_id: number;
  arrangement_id?: number | null;
  settings?: { key?: string | null } | null;
  order?: number;
};

// The API's maximum page size
const PLAN_ITEMS_PER_PAGE = 250;

/** Song items for several plans at once, each plan's in running order */
export const listPlanSongItems = async (
  accessToken: string,
  planIds: string[],
): Promise<CsPlanItem[]> => {
  if (planIds.length === 0) return [];

  const items: RawPlanItem[] = [];
  for (let page = 1; ; page++) {
    const res = await csGet<CsListResponse<RawPlanItem>>(
      accessToken,
      "/planning/plan_items",
      {
        "plan_ids[]": planIds,
        order_by: "order:asc",
        per_page: PLAN_ITEMS_PER_PAGE,
        page,
      },
    );
    items.push(...(res.data ?? []));
    if (res.pagination?.next_page == null) break;
  }

  return items
    .filter((item) => item.type === "song")
    .map((item) => ({
      id: String(item.id),
      planId: String(item.plan_id),
      name: item.name || "Untitled song",
      arrangementId:
        item.arrangement_id != null ? String(item.arrangement_id) : null,
      key: item.settings?.key ?? null,
      order: item.order ?? 0,
    }))
    .sort((a, b) => a.order - b.order);
};

export type CsArrangement = {
  id: string;
  songId: string;
  name: string;
  artist: string | null;
  key: string | null;
  /** Lyrics, with chords either inline in brackets or on their own line */
  chart: string | null;
};

type RawArrangement = {
  id: number;
  song_id: number;
  name?: string;
  artist?: string | null;
  key?: string | null;
  chart?: string | null;
};

export const getArrangement = async (
  accessToken: string,
  arrangementId: string,
): Promise<CsArrangement> => {
  const { data } = await csGet<{ data: RawArrangement }>(
    accessToken,
    `/planning/song_arrangements/${encodeURIComponent(arrangementId)}`,
  );

  return {
    id: String(data.id),
    songId: String(data.song_id),
    name: data.name ?? "",
    artist: data.artist ?? null,
    key: data.key ?? null,
    chart: data.chart ?? null,
  };
};
