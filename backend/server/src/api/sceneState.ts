import { Server } from "@hocuspocus/server";
import { ObjectToTypedMap, Scene, YState } from "@repo/base-plugin";
import { embed, gql, makeExtendSchemaPlugin } from "graphile-utils";
import { PoolClient } from "pg";

import { OurGraphQLContext } from "../graphile.config";
import { serverPluginApi } from "../pluginManager";
import { ERROR_MESSAGE_OVERRIDES } from "../utils/handleErrors";

const currentUserTopicFromContext = async (
  args: any,
  context: any,
  _resolveInfo: any,
) => {
  const {
    rows: [projectRow],
  } = await context.pgClient.query(
    `
      select id from app_public.projects where slug = $1
    `,
    [args.input.projectSlug],
  );

  if (!projectRow) {
    throw new Error("Can't access project");
  }

  return `graphql:sceneState:${projectRow.id}`;
};

const handleSceneState = async (projectSlug: string, pgClient: PoolClient) => {
  const {
    rows: [projectRow],
  } = await pgClient.query(
    `
      select id, organization_id from app_public.projects where slug = $1
    `,
    [projectSlug],
  );

  // Validate that the user can do this
  if (!projectRow || !Server.documents.has(projectRow.id)) {
    throw new Error("Project not found");
  }

  const projectId = projectRow.id;

  try {
    const document = Server.documents.get(projectId);
    const state = document?.getMap() as YState;
    const dataMap = state.get("data")!;

    const sceneStateHandlers = serverPluginApi.getRegisteredSceneStateHandler();

    const sceneResults = Array.from(dataMap.entries())?.map(
      ([id, sectionOrScene]: any) => {
        if (sectionOrScene.get("type") === "section") {
          return;
        }

        const sceneId = id;

        const scene = sectionOrScene as ObjectToTypedMap<
          Scene<Record<string, any>>
        >;

        const pluginResults = Array.from(
          scene.get("children")?.entries() ?? [],
        ).map(([pluginId, plugin]) => {
          const val = sceneStateHandlers
            .find((x) => x.pluginName === plugin.get("plugin"))
            ?.callback(
              plugin,
              // Pass an array of the renderers for now
              // Once we handle multiple renderers, we may want to separate this
              Array.from(state.get("renderer")?.entries() ?? []).map(
                ([, data]) => data.get("children")?.get(sceneId)?.get(pluginId),
              ),
              {
                pluginId,
                sceneId,
                organizationId: projectRow.organization_id,
              },
            );

          if (!val) return {};

          const { dispose, ...data } = val;

          dispose?.();

          return data;
        });

        return {
          sceneId,
          // For now we simple merge the object using a reduce.
          // This works fine only if the property exists only when relevant.
          ...pluginResults.reduce((acc, val) => ({ ...acc, ...val }), {}),
        };
      },
    );

    return sceneResults;
  } catch (e: any) {
    const { code } = e;
    const safeErrorCodes = [
      "WEAKP",
      "LOCKD",
      "EMTKN",
      ...Object.keys(ERROR_MESSAGE_OVERRIDES),
    ];
    if (safeErrorCodes.includes(code)) {
      throw e;
    } else {
      console.error(
        "Unrecognised error in APIPlugin; replacing with sanitized version",
      );
      console.error(e);
      throw Object.assign(new Error("Failed to include scene state"), {
        code,
      });
    }
  }
};

export const sceneState = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    extend type Query {
      sceneState(input: SceneStateInput!): [StateSingle!]!
    }
    extend type Subscription {
      sceneState(input: SceneStateInput!): [StateSingle!]! @pgSubscription(topic: ${embed(
        currentUserTopicFromContext,
      )})
    }

    input SceneStateInput {
      projectSlug: String!
    }

    type StateSingle {
      sceneId: String!
      audioIsPlaying: Boolean
    }
  `,
  resolvers: {
    Query: {
      async sceneState(_, args, context: OurGraphQLContext) {
        return handleSceneState(args.input.projectSlug, context.pgClient);
      },
    },
    Subscription: {
      async sceneState(_, args, context: OurGraphQLContext) {
        return handleSceneState(args.input.projectSlug, context.pgClient);
      },
    },
  },
}));
