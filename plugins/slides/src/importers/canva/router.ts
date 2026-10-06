import { ServerPluginApi, TRPCObject } from "@repo/base-plugin/server";
import { logger } from "@repo/observability";
import z from "zod";

import { loadedContext } from "../../loadedState";
import type { ImportHelpers } from "../helpers";
import { listDesigns } from "./api";
import { createCanvaImporter } from "./importCanvaDesign";
import { getCanvaOAuthConfig } from "./oauth";
import {
  assertConnectionInOrg,
  deleteConnection as deleteCanvaConnection,
  getValidAccessToken as getCanvaAccessToken,
  getOneTimeGrantToken,
  isOrganizationMember,
  listConnections,
} from "./tokenStore";

export type CanvaRouterDeps = {
  serverPluginApi: ServerPluginApi;
  importHelpers: ImportHelpers;
};

type RequestCtx = {
  userId: string | null;
  sessionId: string | null;
  screenGuestSessionId: string | null;
};

export const createCanvaRouter = (t: TRPCObject, deps: CanvaRouterDeps) => {
  const { serverPluginApi, importHelpers } = deps;

  const requireCanvaOrgAccess = async (pluginId: string, ctx: RequestCtx) => {
    const loadedContextData = loadedContext[pluginId];
    if (!loadedContextData) {
      throw new Error("This scene is no longer available.");
    }

    if (
      !ctx.userId ||
      !(await isOrganizationMember(
        serverPluginApi,
        {
          sessionId: ctx.sessionId,
          screenGuestSessionId: ctx.screenGuestSessionId,
        },
        loadedContextData.organizationId,
        ctx.userId,
      ))
    ) {
      throw new Error("You are not a member of this organization.");
    }

    return loadedContextData;
  };

  const requireCanvaConnection = async (
    pluginId: string,
    connectionId: string,
    ctx: RequestCtx,
  ) => {
    const loadedContextData = await requireCanvaOrgAccess(pluginId, ctx);
    await assertConnectionInOrg(
      serverPluginApi,
      connectionId,
      loadedContextData.organizationId,
    );
    return loadedContextData;
  };

  const accessTokenFor = async (
    pluginId: string,
    source: { connectionId?: string; grantId?: string },
    ctx: RequestCtx,
    { consume = false }: { consume?: boolean } = {},
  ) => {
    if (source.connectionId) {
      const loadedContextData = await requireCanvaConnection(
        pluginId,
        source.connectionId,
        ctx,
      );
      return {
        loadedContextData,
        accessToken: await getCanvaAccessToken(
          serverPluginApi,
          source.connectionId,
        ),
      };
    }
    if (source.grantId) {
      const loadedContextData = await requireCanvaOrgAccess(pluginId, ctx);
      return {
        loadedContextData,
        accessToken: await getOneTimeGrantToken(serverPluginApi, {
          grantId: source.grantId,
          organizationId: loadedContextData.organizationId,
          owner: { userId: ctx.userId! },
          consume,
        }),
      };
    }
    throw new Error("Choose a Canva account first.");
  };

  const importCanvaDesign = createCanvaImporter(serverPluginApi, importHelpers);

  const procedures = {
    canvaStatus: t.procedure
      .input(z.object({ pluginId: z.string() }))
      .query(async ({ input: { pluginId }, ctx }) => {
        const config = getCanvaOAuthConfig();
        if (!config) {
          return { configured: false, connections: [] };
        }

        const loadedContextData = loadedContext[pluginId];
        if (!loadedContextData) {
          return { configured: true, connections: [] };
        }

        const connections = await listConnections(
          serverPluginApi,
          {
            sessionId: ctx.sessionId,
            screenGuestSessionId: ctx.screenGuestSessionId,
          },
          loadedContextData.organizationId,
        );

        return {
          configured: true,
          connections: connections.map((c) => ({
            id: c.id,
            label:
              c.canvaDisplayName ??
              (c.connectedByName
                ? `Added by ${c.connectedByName}`
                : "Canva account"),
            canvaDisplayName: c.canvaDisplayName,
            connectedByName: c.connectedByName,
          })),
        };
      }),

    canvaListDesigns: t.procedure
      .input(
        z.object({
          pluginId: z.string(),
          connectionId: z.string().optional(),
          grantId: z.string().optional(),
          query: z.string().optional(),
          cursor: z.string().optional(),
        }),
      )
      .query(
        async ({
          input: {
            pluginId,
            connectionId,
            grantId,
            query,
            cursor: continuation,
          },
          ctx,
        }) => {
          const { accessToken } = await accessTokenFor(
            pluginId,
            { connectionId, grantId },
            ctx,
          );
          const result = await listDesigns(accessToken, {
            query,
            continuation,
          });

          return {
            items: result.items.map((d) => ({
              id: d.id,
              title: d.title ?? "Untitled design",
              pageCount: d.page_count ?? null,
              designTypes: d.design_types ?? [],
              thumbnailUrl: d.thumbnail?.url ?? null,
            })),
            nextCursor: result.continuation ?? null,
          };
        },
      ),

    canvaDisconnect: t.procedure
      .input(z.object({ pluginId: z.string(), connectionId: z.string() }))
      .mutation(async ({ input: { pluginId, connectionId }, ctx }) => {
        await requireCanvaConnection(pluginId, connectionId, ctx);
        await deleteCanvaConnection(serverPluginApi, connectionId);
      }),

    selectCanvaDesign: t.procedure
      .input(
        z.object({
          pluginId: z.string(),
          connectionId: z.string().optional(),
          /** An import-once sign-in, in place of a connection. Used up here. */
          grantId: z.string().optional(),
          designId: z.string(),
          name: z.string().optional(),
          replaceImportId: z.string().optional(),
        }),
      )
      .mutation(
        async ({
          input: {
            pluginId,
            connectionId,
            grantId,
            designId,
            name,
            replaceImportId,
          },
          ctx,
        }) => {
          const { loadedContextData, accessToken } = await accessTokenFor(
            pluginId,
            { connectionId, grantId },
            ctx,
            { consume: true },
          );

          return importCanvaDesign({
            pluginId,
            connectionId,
            accessToken: connectionId ? undefined : accessToken,
            designId,
            name,
            replaceImportId,
            organizationId: loadedContextData.organizationId,
            projectId: loadedContextData.projectId,
            userId: ctx.userId,
          });
        },
      ),
  };

  return { procedures, importCanvaDesign };
};
