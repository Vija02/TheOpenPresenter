import {
  CloudCallError,
  ServerPluginApi,
  TRPCObject,
} from "@repo/base-plugin/server";
import z from "zod";

import { loadedContext } from "../../loadedState";
import type { ImportHelpers } from "../helpers";
import { listDesigns } from "./api";
import { createCanvaImporter } from "./importCanvaDesign";
import {
  CanvaConnectionOption,
  CanvaSignInResult,
  REMOTE_PATHS,
  resolveCanvaMode,
  toConnectionOption,
} from "./provider";
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

/** Where designs come from: a connected account, or a one-time sign-in. */
type CanvaSource = { connectionId?: string; grantId?: string };

export const createCanvaRouter = (t: TRPCObject, deps: CanvaRouterDeps) => {
  const { serverPluginApi, importHelpers } = deps;
  const { integrations } = serverPluginApi;

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

    return { ...loadedContextData, userId: ctx.userId };
  };

  /** The org's mode, for a member of it. Remote calls go to its cloud. */
  const requireMode = async (pluginId: string, ctx: RequestCtx) => {
    const context = await requireCanvaOrgAccess(pluginId, ctx);
    const mode = await resolveCanvaMode(
      serverPluginApi,
      context.organizationId,
    );
    if (mode.mode === "unavailable") throw new Error(mode.reason);
    return { context, mode };
  };

  /**
   * An access token for where designs come from. Here (the cloud) a
   * connection is the org's and a grant the caller's own; in Studio the cloud
   * checks the same and hands back a token.
   */
  const accessTokenFor = async (
    pluginId: string,
    source: CanvaSource,
    ctx: RequestCtx,
    { consume = false }: { consume?: boolean } = {},
  ) => {
    if (!source.connectionId && !source.grantId) {
      throw new Error("Choose a Canva account first.");
    }
    const { context, mode } = await requireMode(pluginId, ctx);

    if (mode.mode === "remote") {
      const { accessToken } = await integrations.callCloud<{
        accessToken: string;
      }>(mode.cloudConnection, REMOTE_PATHS.token, {
        method: "POST",
        body: { ...source, consume },
      });
      return { context, accessToken };
    }

    if (source.connectionId) {
      await assertConnectionInOrg(
        serverPluginApi,
        source.connectionId,
        context.organizationId,
      );
      return {
        context,
        accessToken: await getCanvaAccessToken(
          serverPluginApi,
          source.connectionId,
        ),
      };
    }
    return {
      context,
      accessToken: await getOneTimeGrantToken(serverPluginApi, {
        grantId: source.grantId!,
        organizationId: context.organizationId,
        owner: { userId: context.userId },
        consume,
      }),
    };
  };

  const importCanvaDesign = createCanvaImporter(serverPluginApi, importHelpers);

  const procedures = {
    /** How Canva runs here, and the org's accounts. */
    canvaStatus: t.procedure.input(z.object({ pluginId: z.string() })).query(
      async ({
        input: { pluginId },
        ctx,
      }): Promise<
        | {
            mode: "local" | "remote";
            connections: CanvaConnectionOption[];
          }
        | { mode: "unavailable"; reason: string }
      > => {
        const context = await requireCanvaOrgAccess(pluginId, ctx);
        const mode = await resolveCanvaMode(
          serverPluginApi,
          context.organizationId,
        );

        if (mode.mode === "local") {
          const connections = await listConnections(
            serverPluginApi,
            {
              sessionId: ctx.sessionId,
              screenGuestSessionId: ctx.screenGuestSessionId,
            },
            context.organizationId,
          );
          return {
            mode: "local",
            connections: connections.map(toConnectionOption),
          };
        }
        if (mode.mode === "remote") {
          try {
            const { connections } = await integrations.callCloud<{
              connections: CanvaConnectionOption[];
            }>(mode.cloudConnection, REMOTE_PATHS.status);
            return { mode: "remote", connections };
          } catch (err) {
            // e.g. offline, or the cloud sign-in expired
            if (err instanceof CloudCallError) {
              return { mode: "unavailable", reason: err.message };
            }
            throw err;
          }
        }
        return { mode: "unavailable", reason: mode.reason };
      },
    ),

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
        const { context, mode } = await requireMode(pluginId, ctx);
        if (mode.mode === "remote") {
          await integrations.callCloud(
            mode.cloudConnection,
            REMOTE_PATHS.disconnect,
            { method: "POST", body: { connectionId } },
          );
          return;
        }
        await assertConnectionInOrg(
          serverPluginApi,
          connectionId,
          context.organizationId,
        );
        await deleteCanvaConnection(serverPluginApi, connectionId);
      }),

    /**
     * Studio: starts a sign-in on the cloud, to connect an account or import
     * once. Open `url` in the system browser, then poll canvaSignInStatus.
     */
    canvaBeginSignIn: t.procedure
      .input(
        z.object({ pluginId: z.string(), mode: z.enum(["connect", "once"]) }),
      )
      .mutation(async ({ input: { pluginId, mode: signInMode }, ctx }) => {
        const { mode } = await requireMode(pluginId, ctx);
        if (mode.mode !== "remote") {
          throw new Error("Canva signs in here, not through the cloud.");
        }
        return integrations.callCloud<{ intentId: string; url: string }>(
          mode.cloudConnection,
          REMOTE_PATHS.begin,
          { method: "POST", body: { mode: signInMode } },
        );
      }),

    /** Studio: where a sign-in started by canvaBeginSignIn has got to. */
    canvaSignInStatus: t.procedure
      .input(z.object({ pluginId: z.string(), intentId: z.string() }))
      .query(async ({ input: { pluginId, intentId }, ctx }) => {
        const { mode } = await requireMode(pluginId, ctx);
        if (mode.mode !== "remote") {
          throw new Error("Canva signs in here, not through the cloud.");
        }
        return integrations.callCloud<{
          status: "pending" | "done" | "failed";
          result: CanvaSignInResult | null;
          error: string | null;
        }>(mode.cloudConnection, REMOTE_PATHS.intent, {
          query: { id: intentId },
        });
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
          const { context, accessToken } = await accessTokenFor(
            pluginId,
            { connectionId, grantId },
            ctx,
            { consume: true },
          );

          return importCanvaDesign({
            pluginId,
            connectionId,
            accessToken,
            designId,
            name,
            replaceImportId,
            organizationId: context.organizationId,
            projectId: context.projectId,
            userId: ctx.userId,
          });
        },
      ),
  };

  return { procedures, importCanvaDesign };
};
