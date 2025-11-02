import { cloud } from "@repo/backend-shared";
import {
  OrganizationOverviewIndexPageDocument,
  OrganizationOverviewIndexPageQuery,
} from "@repo/graphql";
import { gql, makeExtendSchemaPlugin } from "graphile-utils";

import { OurGraphQLContext } from "../../graphile.config";
import { ERROR_MESSAGE_OVERRIDES } from "../../utils/handleErrors";

export const cloudOrganizationList = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    extend type CloudConnection {
      organizationList: [String]! @requires(columns: ["id"])
    }
  `,
  resolvers: {
    CloudConnection: {
      async organizationList(
        { id: cloudConnectionId },
        _args,
        context: OurGraphQLContext,
      ) {
        try {
          const { pgClient } = context;
          const {
            rows: [cloudConnection],
          } = await pgClient.query(
            `SELECT * FROM app_public.cloud_connections where id = $1`,
            [cloudConnectionId],
          );

          if (!cloudConnection) {
            throw new Error("Cloud connection not found");
          }

          const urqlClient =
            cloud.getUrqlClientFromCloudConnection(cloudConnection);
          const res =
            await urqlClient.query<OrganizationOverviewIndexPageQuery>(
              OrganizationOverviewIndexPageDocument,
              {},
            );
          if (res.error) {
            throw res.error;
          }

          return (
            res.data?.currentUser?.organizationMemberships.nodes.map(
              (x) => x.organization?.slug,
            ) ?? []
          );
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
            throw Object.assign(
              new Error("Failed to include organization list"),
              {
                code,
              },
            );
          }
        }
      },
    },
  },
}));
