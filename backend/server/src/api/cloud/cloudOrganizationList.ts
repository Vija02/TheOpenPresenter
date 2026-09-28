import { cloud } from "@repo/backend-shared";
import {
  OrganizationOverviewIndexPageDocument,
  OrganizationOverviewIndexPageQuery,
} from "@repo/graphql";
import { gql, makeExtendSchemaPlugin } from "graphile-utils";

import { OurGraphQLContext } from "../../graphile.config";
import { ERROR_MESSAGE_OVERRIDES } from "../../utils/handleErrors";

async function fetchOrganizations(
  cloudConnectionId: string,
  context: OurGraphQLContext,
) {
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

  const urqlClient = cloud.getUrqlClientFromCloudConnection(cloudConnection);
  const res = await urqlClient.query<OrganizationOverviewIndexPageQuery>(
    OrganizationOverviewIndexPageDocument,
    {},
  );
  if (res.error) {
    throw res.error;
  }
  return res;
}

function sanitize(e: any): Error {
  const { code } = e;
  const safeErrorCodes = [
    "WEAKP",
    "LOCKD",
    "EMTKN",
    ...Object.keys(ERROR_MESSAGE_OVERRIDES),
  ];
  if (safeErrorCodes.includes(code)) {
    return e;
  }
  console.error(
    "Unrecognised error in APIPlugin; replacing with sanitized version",
  );
  console.error(e);
  return Object.assign(new Error("Failed to include organization list"), {
    code,
  });
}

export const cloudOrganizationList = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    extend type CloudConnection {
      organizationList: [CloudOrganization!]! @requires(columns: ["id"])
    }

    type CloudOrganization {
      slug: String!
      name: String!
    }
  `,
  resolvers: {
    CloudConnection: {
      async organizationList(
        { id: cloudConnectionId }: { id: string },
        _args: unknown,
        context: OurGraphQLContext,
      ) {
        try {
          const res = await fetchOrganizations(cloudConnectionId, context);
          return (
            res.data?.currentUser?.organizationMemberships.nodes
              .map((x) => x.organization)
              .filter((o): o is NonNullable<typeof o> => Boolean(o))
              .map((o) => ({ slug: o.slug, name: o.name })) ?? []
          );
        } catch (e: any) {
          throw sanitize(e);
        }
      },
    },
  },
}));
