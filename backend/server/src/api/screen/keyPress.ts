import { KeyPressType, YState, keyPressTypes } from "@repo/base-plugin";
import { outputProgramId, readOutputs } from "@repo/layout";
import { gql, makeExtendSchemaPlugin } from "graphile-utils";

import { OurGraphQLContext } from "../../graphile.config";
import { hocuspocus } from "../../hocuspocusInstance";
import { dispatchKeyPress } from "../keyPressDispatch";
import { isMemberOfOrg } from "./helpers";

/** A screen shows an output; its presses move the program the output shows */
const outputProgram = (projectId: string, outputId: string): string => {
  const state = hocuspocus.documents.get(projectId)?.getMap() as
    | YState
    | undefined;
  if (!state) return outputId;
  return outputProgramId(
    readOutputs({
      renderer: state.get("renderer")?.toJSON() ?? {},
      outputs: state.get("outputs")?.toJSON() ?? null,
    }),
    outputId,
  );
};

const screenKeyPressPlugin = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    extend type Mutation {
      """
      Trigger a key press on the project currently assigned to a screen
      """
      screenKeyPress(input: ScreenKeyPressInput!): ScreenKeyPressPayload
    }

    input ScreenKeyPressInput {
      keyType: String!
      screenId: UUID!
      sceneId: String
    }

    type ScreenKeyPressPayload {
      success: Boolean!
    }
  `,
  resolvers: {
    Mutation: {
      async screenKeyPress(_mutation, args, context: OurGraphQLContext) {
        const { keyType, screenId, sceneId: inputSceneId } = args.input;
        const { pgClient, rootPgPool, sessionId, screenGuestSessionId } =
          context;

        if (!keyPressTypes.includes(keyType)) {
          throw new Error("Invalid keyType");
        }

        const {
          rows: [screenRow],
        } = await rootPgPool.query(
          `
            select id,
              organization_id,
              current_project_id,
              current_renderer_id
            from app_public.screens
            where id = $1
          `,
          [screenId],
        );

        if (!screenRow) {
          throw new Error("Screen not found");
        }

        const {
          organization_id: organizationId,
          current_project_id: projectId,
          current_renderer_id: rendererId,
        } = screenRow;

        if (!projectId) {
          throw new Error("Screen has no project assigned");
        }

        const isOrgMember = sessionId
          ? await isMemberOfOrg(pgClient, organizationId)
          : false;

        let authorized = isOrgMember;
        if (!authorized && screenGuestSessionId) {
          const {
            rows: [acRow],
          } = await rootPgPool.query(
            `
              select 1
              from app_public.screen_active_controllers
              where screen_id = $1
                and screen_guest_session_id = $2
            `,
            [screenId, screenGuestSessionId],
          );
          authorized = !!acRow;
        }

        if (!authorized) {
          throw new Error("Not authorized to control this screen");
        }

        const result = dispatchKeyPress({
          keyType: keyType as KeyPressType,
          projectId,
          rendererId: outputProgram(projectId, rendererId),
          sceneId: inputSceneId,
          organizationId,
        });

        if (!result.success) {
          return null;
        }
        return { success: true };
      },
    },
  },
}));

export default screenKeyPressPlugin;
