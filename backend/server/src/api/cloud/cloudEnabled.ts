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
        // For now, just check that redis runs
        return !!process.env.REDIS_URL;
      },
    },
  },
}));
