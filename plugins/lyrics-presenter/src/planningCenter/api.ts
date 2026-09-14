import { logger } from "@repo/observability";

import {
  JsonApiResource,
  PcoNoServicesAccessError,
  asArray,
  asOne,
  pcoGet,
} from "./client";

export type PcoIdentity = {
  pcoOrganizationId: string;
  pcoOrganizationName: string | null;
  pcoPersonId: string;
  pcoPersonName: string | null;
};

export const getIdentity = async (
  accessToken: string,
): Promise<PcoIdentity> => {
  // Not Promise.all: a failing label request must not mask the real 403.
  const me = asOne(await pcoGet(accessToken, "/services/v2/me"));

  let org: JsonApiResource | null = null;
  try {
    org = asOne(await pcoGet(accessToken, "/services/v2"));
  } catch (err) {
    if (err instanceof PcoNoServicesAccessError) throw err;
    logger.warn(
      { err, scope: "pcoApi" },
      "lyrics-presenter: could not read the Planning Center organization name",
    );
  }

  const fullName =
    me?.attributes?.full_name ??
    [me?.attributes?.first_name, me?.attributes?.last_name]
      .filter(Boolean)
      .join(" ");

  return {
    pcoOrganizationId: String(org?.id ?? "unknown"),
    pcoOrganizationName: (org?.attributes?.name as string) ?? null,
    pcoPersonId: String(me?.id ?? "unknown"),
    pcoPersonName: fullName || null,
  };
};

export type PcoServiceType = { id: string; name: string; sequence: number };

export const listServiceTypes = async (
  accessToken: string,
): Promise<PcoServiceType[]> => {
  const doc = await pcoGet(accessToken, "/services/v2/service_types", {
    per_page: 100,
    order: "sequence",
  });

  return asArray(doc).map((x) => ({
    id: x.id,
    name: (x.attributes?.name as string) ?? "Untitled service type",
    sequence: (x.attributes?.sequence as number) ?? 0,
  }));
};

export type PcoPlan = {
  id: string;
  serviceTypeId: string;
  serviceTypeName: string;
  title: string;
  dates: string | null;
  sortDate: string | null;
  itemsCount: number;
};

/**
 * Plans for one service type. Defaults to the plans around now: Planning
 * Center's `future` filter only returns upcoming ones, so recent past plans
 * are fetched separately and the two are merged by the caller.
 */
export const listPlans = async (
  accessToken: string,
  serviceType: PcoServiceType,
  { filter, perPage = 10 }: { filter: "future" | "past"; perPage?: number },
): Promise<PcoPlan[]> => {
  const doc = await pcoGet(
    accessToken,
    `/services/v2/service_types/${serviceType.id}/plans`,
    {
      per_page: perPage,
      filter,
      // Past plans are most useful newest-first; future plans soonest-first.
      order: filter === "past" ? "-sort_date" : "sort_date",
    },
  );

  return asArray(doc).map((x) => ({
    id: x.id,
    serviceTypeId: serviceType.id,
    serviceTypeName: serviceType.name,
    title:
      (x.attributes?.title as string) ||
      (x.attributes?.series_title as string) ||
      (x.attributes?.dates as string) ||
      "Untitled plan",
    dates: (x.attributes?.dates as string) ?? null,
    sortDate: (x.attributes?.sort_date as string) ?? null,
    itemsCount: (x.attributes?.items_count as number) ?? 0,
  }));
};

export type PcoPlanSong = {
  /** The Item id within the plan. Unique per plan, so it keys the UI rows. */
  itemId: string;
  songId: string | null;
  arrangementId: string | null;
  title: string;
  author: string | null;
  /** The plan's per-item arrangement override, when one is set. */
  customSequence: string[];
};

export const listPlanSongs = async (
  accessToken: string,
  serviceTypeId: string,
  planId: string,
): Promise<PcoPlanSong[]> => {
  const doc = await pcoGet(
    accessToken,
    `/services/v2/service_types/${serviceTypeId}/plans/${planId}/items`,
    { per_page: 100, include: "song,arrangement" },
  );

  const includedById = new Map(
    (doc.included ?? []).map((x) => [`${x.type}:${x.id}`, x]),
  );

  return asArray(doc)
    .filter((item) => item.attributes?.item_type === "song")
    .map((item) => {
      const songRef = item.relationships?.song?.data ?? null;
      const arrangementRef = item.relationships?.arrangement?.data ?? null;
      const song = songRef ? includedById.get(`Song:${songRef.id}`) : undefined;

      return {
        itemId: item.id,
        songId: songRef?.id ?? null,
        arrangementId: arrangementRef?.id ?? null,
        title:
          (song?.attributes?.title as string) ||
          (item.attributes?.title as string) ||
          "Untitled song",
        author: (song?.attributes?.author as string) ?? null,
        customSequence:
          (item.attributes?.custom_arrangement_sequence as string[]) ?? [],
      };
    });
};

export type PcoArrangement = {
  name: string | null;
  lyrics: string | null;
  chordChart: string | null;
  chordChartKey: string | null;
  sequence: string[];
};

export const getArrangement = async (
  accessToken: string,
  songId: string,
  arrangementId: string,
): Promise<PcoArrangement | null> => {
  const doc = await pcoGet(
    accessToken,
    `/services/v2/songs/${songId}/arrangements/${arrangementId}`,
  );
  const arrangement = asOne(doc);
  if (!arrangement) return null;

  return {
    name: (arrangement.attributes?.name as string) ?? null,
    lyrics: (arrangement.attributes?.lyrics as string) ?? null,
    chordChart: (arrangement.attributes?.chord_chart as string) ?? null,
    chordChartKey: (arrangement.attributes?.chord_chart_key as string) ?? null,
    sequence: (arrangement.attributes?.sequence as string[]) ?? [],
  };
};
