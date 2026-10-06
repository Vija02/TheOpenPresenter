import { ServerPluginApi, TRPCObject } from "@repo/base-plugin/server";
import z from "zod";

import { loadedContext } from "../../loadedState";
import type { Importers } from "../index";
import { getGoogleAppId, getGoogleClientId } from "./oauth";
import {
  beginRemotePick,
  getGoogleAccessToken,
  getRemotePickStatus,
  resolveGoogleMode,
} from "./provider";
import {
  deleteConnection,
  getConnectionInOrg,
  getValidAccessToken,
  listConnectionsForUser,
} from "./tokenStore";

type RequestCtx = { userId: string | null };

export const createGoogleSlidesRouter = (
  t: TRPCObject,
  {
    serverPluginApi,
    importGoogleSlidesDeck,
  }: {
    serverPluginApi: ServerPluginApi;
    importGoogleSlidesDeck: Importers["importGoogleSlidesDeck"];
  },
) => {
  /** The scene's organization, if the caller is a member of it. */
  const requireMember = async (pluginId: string, ctx: RequestCtx) => {
    const context = loadedContext[pluginId];
    if (!context) {
      throw new Error("This scene is no longer available.");
    }
    if (
      !ctx.userId ||
      !(await serverPluginApi.integrations.isOrganizationMember(
        context.organizationId,
        ctx.userId,
      ))
    ) {
      throw new Error("You are not a member of this organization.");
    }
    return { ...context, userId: ctx.userId };
  };

  /** A stored connection here that belongs to this user. */
  const requireOwnConnection = async (
    organizationId: string,
    userId: string,
    connectionId: string,
  ) => {
    const connection = await getConnectionInOrg(
      serverPluginApi,
      connectionId,
      organizationId,
    );
    if (!connection || connection.connectedByUserId !== userId) {
      throw new Error("That Google account is not connected.");
    }
    return connection;
  };

  const procedures = {
    /** How Google Slides runs here, and what the client needs to drive it. */
    googleSlidesStatus: t.procedure
      .input(z.object({ pluginId: z.string() }))
      .query(async ({ input: { pluginId }, ctx }) => {
        const { organizationId, userId } = await requireMember(pluginId, ctx);
        const resolved = await resolveGoogleMode(serverPluginApi, organizationId);

        if (resolved.mode === "local") {
          const connections = await listConnectionsForUser(
            serverPluginApi,
            organizationId,
            userId,
          );
          return {
            mode: "local" as const,
            clientId: getGoogleClientId(),
            appId: getGoogleAppId(),
            // Most recently used first
            accounts: connections.map((connection) => ({
              id: connection.id,
              label:
                connection.googleEmail ??
                connection.googleDisplayName ??
                "Google account",
              // Only worth showing when it differs from the email
              displayName:
                connection.googleEmail && connection.googleDisplayName
                  ? connection.googleDisplayName
                  : null,
            })),
          };
        }
        if (resolved.mode === "remote") {
          return { mode: "remote" as const };
        }
        return { mode: "unavailable" as const, reason: resolved.reason };
      }),

    /** Local mode: a token for the in-app picker, from the user's own account. */
    googleSlidesPickerToken: t.procedure
      .input(z.object({ pluginId: z.string(), connectionId: z.string() }))
      .mutation(async ({ input: { pluginId, connectionId }, ctx }) => {
        const { organizationId, userId } = await requireMember(pluginId, ctx);
        const connection = await requireOwnConnection(
          organizationId,
          userId,
          connectionId,
        );
        return getValidAccessToken(serverPluginApi, connection.id);
      }),

    googleSlidesDisconnect: t.procedure
      .input(z.object({ pluginId: z.string(), connectionId: z.string() }))
      .mutation(async ({ input: { pluginId, connectionId }, ctx }) => {
        const { organizationId, userId } = await requireMember(pluginId, ctx);
        const connection = await requireOwnConnection(
          organizationId,
          userId,
          connectionId,
        );
        await deleteConnection(serverPluginApi, connection.id);
      }),

    /** Remote mode: starts a pick on the cloud. Open `url` externally. */
    googleSlidesBeginPick: t.procedure
      .input(z.object({ pluginId: z.string() }))
      .mutation(async ({ input: { pluginId }, ctx }) => {
        const { organizationId } = await requireMember(pluginId, ctx);
        return beginRemotePick(serverPluginApi, organizationId);
      }),

    /** Remote mode: polled until the pick is done or failed. */
    googleSlidesPickStatus: t.procedure
      .input(z.object({ pluginId: z.string(), intentId: z.string() }))
      .query(async ({ input: { pluginId, intentId }, ctx }) => {
        const { organizationId } = await requireMember(pluginId, ctx);
        return getRemotePickStatus(serverPluginApi, organizationId, intentId);
      }),

    /** Imports a deck from a stored connection, local or remote. */
    selectGoogleSlide: t.procedure
      .input(
        z.object({
          pluginId: z.string(),
          connectionId: z.string(),
          presentationId: z.string(),
          name: z.string().optional(),
          replaceImportId: z.string().optional(),
        }),
      )
      .mutation(
        async ({
          input: { pluginId, connectionId, presentationId, name, replaceImportId },
          ctx,
        }) => {
          const { organizationId, userId } = await requireMember(pluginId, ctx);
          // Remote connections are checked by the cloud against its own user
          const mode = await resolveGoogleMode(serverPluginApi, organizationId);
          if (mode.mode === "local") {
            await requireOwnConnection(organizationId, userId, connectionId);
          }
          const { accessToken } = await getGoogleAccessToken(
            serverPluginApi,
            organizationId,
            connectionId,
          );
          return importGoogleSlidesDeck({
            pluginId,
            presentationId,
            token: accessToken,
            name,
            replaceImportId,
            userId,
            googleConnectionId: connectionId,
          });
        },
      ),
  };

  return { procedures };
};
