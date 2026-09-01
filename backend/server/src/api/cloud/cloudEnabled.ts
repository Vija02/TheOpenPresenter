import { gql, makeExtendSchemaPlugin } from "graphile-utils";

export const cloudEnabled = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    extend type Query {
      cloudEnabled: Boolean!
    }
  `,
  resolvers: {
    Query: {
      async cloudEnabled() {
        return process.env.CLOUD_TAB_ENABLED !== "0";
      },
    },
  },
}));
