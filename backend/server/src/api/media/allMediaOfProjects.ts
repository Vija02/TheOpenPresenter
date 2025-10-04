import { gql, makeExtendSchemaPlugin } from "graphile-utils";

import { OurGraphQLContext } from "../../graphile.config";
import { ERROR_MESSAGE_OVERRIDES } from "../../utils/handleErrors";

export const allMediaOfProjects = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    extend type Query {
      """
      Get all the media of a project including its dependencies
      """
      allMediaOfProjects(input: AllMediaOfProjectsInput): [Media]
    }

    input AllMediaOfProjectsInput {
      projectIds: [UUID!]
    }
  `,
  resolvers: {
    Query: {
      async allMediaOfProjects(
        _,
        args,
        context: OurGraphQLContext,
        resolveInfo,
      ) {
        const { selectGraphQLResultFromTable, build } = resolveInfo.graphile;
        const { pgClient } = context;
        const { projectIds } = args.input;

        try {
          const { rows } = await pgClient.query(
            `SELECT pm.media_id FROM app_public.projects p join app_public.project_medias pm on p.id = pm.project_id where id = ANY($1)`,
            [projectIds],
          );

          const mediaIds = Array.from(new Set(rows.map((x) => x.media_id)));

          // Get dependencies
          const { rows: recursiveRows } = await pgClient.query(
            `
              WITH RECURSIVE child_tree AS (
                -- Base case: direct children
                SELECT child_media_id
                FROM app_public.media_dependencies
                WHERE parent_media_id = ANY($1)
                
                UNION
                
                -- Recursive case: children of children
                SELECT md.child_media_id
                FROM app_public.media_dependencies md
                JOIN child_tree ct ON md.parent_media_id = ct.child_media_id
              )
              SELECT * FROM child_tree;
            `,
            [mediaIds],
          );

          const allChildMediaIds = recursiveRows.map(
            (row) => row.child_media_id,
          );
          const allMediaIds = Array.from(
            new Set(allChildMediaIds.concat(mediaIds)),
          );

          // Build return query
          const sql = build.pgSql;
          const finalData = await selectGraphQLResultFromTable(
            sql.fragment`app_public.medias`,
            (tableAlias, sqlBuilder) => {
              sqlBuilder.where(
                sql.fragment`${tableAlias}.id = ANY(${sql.value(allMediaIds)})`,
              );
            },
          );
          return finalData;
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
