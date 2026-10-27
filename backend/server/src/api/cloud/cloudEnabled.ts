import { gql, makeExtendSchemaPlugin } from "graphile-utils";

/** Whether this server can connect to a cloud; off on the cloud itself. */
export const isCloudEnabled = () => process.env.CLOUD_TAB_ENABLED !== "0";

export const cloudEnabled = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    extend type Query {
      cloudEnabled: Boolean!
    }
  `,
  resolvers: {
    Query: {
      async cloudEnabled() {
        return isCloudEnabled();
      },
    },
  },
}));
