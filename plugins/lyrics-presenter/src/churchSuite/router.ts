import { TRPCObject } from "@repo/base-plugin/server";
import { logger } from "@repo/observability";
import z from "zod";

import { convertChurchSuiteChart } from "../importer/churchSuite";
import { isOrganizationMember } from "../planningCenter/tokenStore";
import { resolveContext } from "../songbook";
import { Api } from "../songbook/types";
import {
  CsArrangement,
  getAccountInfo,
  getArrangement,
  listPlanSongItems,
  listPlans,
} from "./api";
import { CsUnauthorizedError, requestAccessToken } from "./client";
import {
  deleteConnection,
  getAccessToken,
  getConnection,
  saveConnection,
} from "./tokenStore";

type RequestCtx = {
  userId: string | null;
  sessionId: string | null;
  screenGuestSessionId: string | null;
};

const authOf = (ctx: RequestCtx) => ({
  sessionId: ctx.sessionId,
  screenGuestSessionId: ctx.screenGuestSessionId,
});

const PAST_DAYS = 14;
const FUTURE_DAYS = 60;
const MAX_PLANS = 12;
const PLANS_PER_STATUS = 50;
const ARRANGEMENT_CONCURRENCY = 4;

const ARRANGEMENT_TTL_MS = 5 * 60 * 1000;
const ARRANGEMENT_CACHE_MAX = 1000;
const arrangementCache = new Map<
  string,
  { value: CsArrangement; expiresAt: number }
>();

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

const mapLimit = async <T, R>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await run(items[index]!);
      }
    },
  );
  await Promise.all(workers);
  return results;
};

export const createChurchSuiteRouter = (t: TRPCObject, api: Api) => {
  const requireOrgAccess = async (pluginId: string, ctx: RequestCtx) => {
    const context = resolveContext(pluginId);

    if (
      !ctx.userId ||
      !(await isOrganizationMember(
        api,
        authOf(ctx),
        context.organizationId,
        ctx.userId,
      ))
    ) {
      throw new Error("You are not a member of this organization.");
    }

    return context;
  };

  /** Runs with a token, minting a fresh one once if ChurchSuite refuses it */
  const withToken = async <T>(
    organizationId: string,
    run: (accessToken: string) => Promise<T>,
  ): Promise<T> => {
    try {
      return await run(await getAccessToken(api, organizationId));
    } catch (err) {
      if (!(err instanceof CsUnauthorizedError)) throw err;
      return run(
        await getAccessToken(api, organizationId, { forceRefresh: true }),
      );
    }
  };

  const cachedArrangement = async (
    organizationId: string,
    accessToken: string,
    arrangementId: string,
  ): Promise<CsArrangement> => {
    const cacheKey = `${organizationId}:${arrangementId}`;
    const hit = arrangementCache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) return hit.value;

    const value = await getArrangement(accessToken, arrangementId);

    arrangementCache.delete(cacheKey);
    arrangementCache.set(cacheKey, {
      value,
      expiresAt: Date.now() + ARRANGEMENT_TTL_MS,
    });
    // Map keeps insertion order, so the first key is the oldest
    if (arrangementCache.size > ARRANGEMENT_CACHE_MAX) {
      arrangementCache.delete(arrangementCache.keys().next().value!);
    }

    return value;
  };

  return {
    status: t.procedure
      .input(z.object({ pluginId: z.string() }))
      .query(async ({ input: { pluginId }, ctx }) => {
        const { organizationId } = resolveContext(pluginId);
        const connection = await getConnection(
          api,
          authOf(ctx),
          organizationId,
        );

        return {
          connection: connection && {
            label: connection.accountName ?? "ChurchSuite account",
            subdomain: connection.accountSubdomain,
            connectedByName: connection.connectedByName,
          },
        };
      }),

    /** Checks the credentials against ChurchSuite before saving them */
    connect: t.procedure
      .input(
        z.object({
          pluginId: z.string(),
          clientId: z.string().trim().min(1).max(500),
          clientSecret: z.string().trim().min(1).max(500),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const { organizationId } = await requireOrgAccess(input.pluginId, ctx);

        const token = await requestAccessToken({
          clientId: input.clientId,
          clientSecret: input.clientSecret,
        });

        // Fails with a 403 here, not at import time, when the API user has
        // no access to Planning
        const now = Date.now();
        await listPlans(token.access_token, {
          status: "published",
          startsAfter: isoDate(new Date(now)),
          startsBefore: isoDate(new Date(now + 86_400_000)),
          perPage: 1,
        });

        let accountName: string | null = null;
        let accountSubdomain: string | null = null;
        try {
          const info = await getAccountInfo(token.access_token);
          accountName = info.name;
          accountSubdomain = info.subdomain;
        } catch (err) {
          logger.warn(
            { err, scope: "churchSuiteApi" },
            "lyrics-presenter: could not read the ChurchSuite account name",
          );
        }

        await saveConnection(api, {
          organizationId,
          userId: ctx.userId,
          clientId: input.clientId,
          clientSecret: input.clientSecret,
          token,
          accountName,
          accountSubdomain,
        });

        return { success: true };
      }),

    disconnect: t.procedure
      .input(z.object({ pluginId: z.string() }))
      .mutation(async ({ input: { pluginId }, ctx }) => {
        const { organizationId } = await requireOrgAccess(pluginId, ctx);
        await deleteConnection(api, organizationId);
        return { success: true };
      }),

    /** The plans around today, nearest first, with their songs */
    plans: t.procedure
      .input(z.object({ pluginId: z.string() }))
      .query(async ({ input: { pluginId }, ctx }) => {
        const { organizationId } = await requireOrgAccess(pluginId, ctx);

        return withToken(organizationId, async (accessToken) => {
          const now = Date.now();
          const window = {
            startsAfter: isoDate(new Date(now - PAST_DAYS * 86_400_000)),
            startsBefore: isoDate(new Date(now + FUTURE_DAYS * 86_400_000)),
            perPage: PLANS_PER_STATUS,
          };

          const [published, drafts] = await Promise.all([
            listPlans(accessToken, { ...window, status: "published" }),
            listPlans(accessToken, { ...window, status: "draft" }),
          ]);

          const startOf = (plan: { date: string; time: string | null }) =>
            new Date(`${plan.date}T${plan.time ?? "00:00:00"}`).getTime();

          const plans = [...published, ...drafts]
            .sort(
              (a, b) => Math.abs(startOf(a) - now) - Math.abs(startOf(b) - now),
            )
            .slice(0, MAX_PLANS);

          const items = await listPlanSongItems(
            accessToken,
            plans.map((plan) => plan.id),
          );

          const arrangementIds = [
            ...new Set(
              items.flatMap((item) =>
                item.arrangementId ? [item.arrangementId] : [],
              ),
            ),
          ];

          const arrangements = new Map<string, CsArrangement>();
          await mapLimit(
            arrangementIds,
            ARRANGEMENT_CONCURRENCY,
            async (id) => {
              try {
                arrangements.set(
                  id,
                  await cachedArrangement(organizationId, accessToken, id),
                );
              } catch (err) {
                // A deleted arrangement shouldn't hide the rest of the plan
                if (err instanceof CsUnauthorizedError) throw err;
                logger.warn(
                  { err, arrangementId: id, scope: "churchSuiteApi" },
                  "lyrics-presenter: could not read a ChurchSuite arrangement",
                );
              }
            },
          );

          return {
            plans: plans.map((plan) => ({
              ...plan,
              songs: items
                .filter((item) => item.planId === plan.id)
                .flatMap((item) => {
                  const arrangement = item.arrangementId
                    ? arrangements.get(item.arrangementId)
                    : undefined;
                  if (!arrangement) return [];
                  return [
                    {
                      itemId: item.id,
                      songId: arrangement.songId,
                      arrangementId: arrangement.id,
                      title: item.name || arrangement.name,
                      author: arrangement.artist,
                      key: item.key ?? arrangement.key,
                    },
                  ];
                }),
            })),
          };
        });
      }),

    getSong: t.procedure
      .input(
        z.object({
          pluginId: z.string(),
          arrangementId: z.string(),
          title: z.string().optional(),
          author: z.string().nullish(),
          key: z.string().nullish(),
        }),
      )
      .query(async ({ input, ctx }) => {
        const { organizationId } = await requireOrgAccess(input.pluginId, ctx);

        return withToken(organizationId, async (accessToken) => {
          const arrangement = await cachedArrangement(
            organizationId,
            accessToken,
            input.arrangementId,
          );

          return {
            title: input.title || arrangement.name,
            author: input.author ?? arrangement.artist,
            content: convertChurchSuiteChart(arrangement.chart ?? ""),
            key: input.key || arrangement.key || null,
          };
        });
      }),
  };
};
