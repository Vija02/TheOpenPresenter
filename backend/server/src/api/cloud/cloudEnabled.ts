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
        // DEBT: For now, let's always enable it.
        return true;
      },
    },
  },
}));
