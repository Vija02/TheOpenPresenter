import { TRPCObject } from "@repo/base-plugin/server";
import z from "zod";

import { convertPcoLyrics } from "../importer/planningCenter";
import { resolveContext } from "../songbook";
import { Api } from "../songbook/types";
import {
  getArrangement,
  listPlanSongs,
  listPlans,
  listServiceTypes,
} from "./api";
import { PcoNoServicesAccessError } from "./client";
import { getPcoOAuthConfig } from "./oauth";
import {
  assertConnectionInOrg,
  deleteConnection,
  getValidAccessToken,
  isOrganizationMember,
  listConnections,
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

const FUTURE_PLANS_PER_SERVICE_TYPE = 6;
const PAST_PLANS_PER_SERVICE_TYPE = 4;

const NO_SERVICES_ACCESS_MESSAGE =
  "This Planning Center account cannot open the Services product. Ask an " +
  "administrator to give the person who connected it access to Services.";

const withFriendlyErrors = async <T>(run: () => Promise<T>): Promise<T> => {
  try {
    return await run();
  } catch (err) {
    if (err instanceof PcoNoServicesAccessError) {
      throw new Error(NO_SERVICES_ACCESS_MESSAGE);
    }
    throw err;
  }
};

export const createPlanningCenterRouter = (t: TRPCObject, api: Api) => {
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

  const requireConnection = async (
    pluginId: string,
    connectionId: string,
    ctx: RequestCtx,
  ) => {
    const context = await requireOrgAccess(pluginId, ctx);
    await assertConnectionInOrg(api, connectionId, context.organizationId);
    return context;
  };

  return {
    status: t.procedure
      .input(z.object({ pluginId: z.string() }))
      .query(async ({ input: { pluginId }, ctx }) => {
        if (!getPcoOAuthConfig()) {
          return { configured: false, connections: [] };
        }

        const context = resolveContext(pluginId);
        const connections = await listConnections(
          api,
          authOf(ctx),
          context.organizationId,
        );

        return {
          configured: true,
          connections: connections.map((c) => ({
            id: c.id,
            label:
              c.pcoOrganizationName ??
              c.pcoPersonName ??
              (c.connectedByName
                ? `Added by ${c.connectedByName}`
                : "Planning Center account"),
            pcoOrganizationName: c.pcoOrganizationName,
            pcoPersonName: c.pcoPersonName,
            connectedByName: c.connectedByName,
          })),
        };
      }),

    disconnect: t.procedure
      .input(z.object({ pluginId: z.string(), connectionId: z.string() }))
      .mutation(async ({ input: { pluginId, connectionId }, ctx }) => {
        await requireConnection(pluginId, connectionId, ctx);
        await deleteConnection(api, connectionId);
        return { success: true };
      }),

    /** Every service type's plans around today */
    plans: t.procedure
      .input(z.object({ pluginId: z.string(), connectionId: z.string() }))
      .query(async ({ input: { pluginId, connectionId }, ctx }) => {
        await requireConnection(pluginId, connectionId, ctx);

        return withFriendlyErrors(async () => {
          const accessToken = await getValidAccessToken(api, connectionId);

          const serviceTypes = await listServiceTypes(accessToken);

          const results = await Promise.all(
            serviceTypes.flatMap((serviceType) => [
              listPlans(accessToken, serviceType, {
                filter: "future",
                perPage: FUTURE_PLANS_PER_SERVICE_TYPE,
              }),
              listPlans(accessToken, serviceType, {
                filter: "past",
                perPage: PAST_PLANS_PER_SERVICE_TYPE,
              }),
            ]),
          );

          const plans = results.flat();

          // Nearest services first: upcoming ascending, then past descending.
          const now = Date.now();
          const distance = (iso: string | null) =>
            iso
              ? Math.abs(new Date(iso).getTime() - now)
              : Number.MAX_SAFE_INTEGER;

          plans.sort((a, b) => distance(a.sortDate) - distance(b.sortDate));

          return { plans };
        });
      }),

    /** The song items of one plan, in plan order. */
    planSongs: t.procedure
      .input(
        z.object({
          pluginId: z.string(),
          connectionId: z.string(),
          serviceTypeId: z.string(),
          planId: z.string(),
        }),
      )
      .query(async ({ input, ctx }) => {
        await requireConnection(input.pluginId, input.connectionId, ctx);

        return withFriendlyErrors(async () => {
          const accessToken = await getValidAccessToken(
            api,
            input.connectionId,
          );

          return {
            songs: await listPlanSongs(
              accessToken,
              input.serviceTypeId,
              input.planId,
            ),
          };
        });
      }),

    getSong: t.procedure
      .input(
        z.object({
          pluginId: z.string(),
          connectionId: z.string(),
          songId: z.string(),
          arrangementId: z.string(),
          title: z.string().optional(),
          author: z.string().nullish(),
          key: z.string().nullish(),
        }),
      )
      .query(async ({ input, ctx }) => {
        await requireConnection(input.pluginId, input.connectionId, ctx);

        return withFriendlyErrors(async () => {
          const accessToken = await getValidAccessToken(
            api,
            input.connectionId,
          );

          const arrangement = await getArrangement(
            accessToken,
            input.songId,
            input.arrangementId,
          );

          const source = arrangement?.chordChart || arrangement?.lyrics || "";
          const content = convertPcoLyrics(source);

          return {
            title: input.title ?? "",
            author: input.author ?? null,
            content,
            chordChartKey: input.key || arrangement?.chordChartKey || null,
          };
        });
      }),
  };
};
