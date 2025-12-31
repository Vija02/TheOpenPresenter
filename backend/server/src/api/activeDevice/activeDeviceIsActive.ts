import { makeAddPgTableConditionPlugin } from "graphile-utils";

export const activeDeviceIsActive = makeAddPgTableConditionPlugin(
  "app_public",
  "organization_active_devices",
  "isActive",
  (build) => {
    const { GraphQLBoolean } = build.graphql;
    return {
      description:
        "Filters to records that are active (updated_at within 1m30s of current time)",
      type: GraphQLBoolean,
    };
  },
  (value, helpers) => {
    const { sql, sqlTableAlias } = helpers;

    if (value === true) {
      return sql.fragment`${sqlTableAlias}.updated_at > NOW() - INTERVAL '90 seconds'`;
    } else if (value === false) {
      return sql.fragment`${sqlTableAlias}.updated_at <= NOW() - INTERVAL '90 seconds'`;
    }

    return sql.fragment`TRUE`;
  },
);
