import { logger } from "@repo/observability";
import { gql, makeExtendSchemaPlugin } from "graphile-utils";

import { OurGraphQLContext } from "../graphile.config";
import {
  buildDemoScenes,
  buildLyricsScenes,
  buildProjectDocument,
} from "../middleware/demoScenes";

export const createSampleProject = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    extend type Mutation {
      """
      Creates a sample project in an organization that has no projects yet.
      Returns a null project if the organization already has one.
      """
      createSampleProject(
        input: CreateSampleProjectInput!
      ): CreateSampleProjectPayload
    }

    input CreateSampleProjectInput {
      organizationId: UUID!
      slug: String!
      """
      The day of the service. The client picks it so it's in the user's time zone
      """
      targetDate: Datetime
    }

    type CreateSampleProjectPayload {
      projectId: UUID
      projectSlug: String
    }
  `,
  resolvers: {
    Mutation: {
      async createSampleProject(_mutation, args, context: OurGraphQLContext) {
        const { organizationId, slug, targetDate } = args.input;
        const { pgClient, rootPgPool } = context;

        // Must be a member
        const {
          rows: [organization],
        } = await pgClient.query(
          `
            select o.organization_type, app_public.current_user_id() as user_id
            from app_public.organizations o
            where o.id = $1
              and o.id in (select app_public.current_user_member_organization_ids())
          `,
          [organizationId],
        );
        if (!organization) {
          throw new Error("Organization not found");
        }

        const isChurch = organization.organization_type === "church";
        const scenes = isChurch
          ? buildLyricsScenes({ withSongs: true })
          : buildDemoScenes();
        const document = await buildProjectDocument(scenes);

        // Only seed an empty organization, so a retry doesn't add another
        const {
          rows: [project],
        } = await rootPgPool.query(
          `
            insert into app_public.projects
              (organization_id, creator_user_id, name, slug, target_date, document)
            select $1, $2, $3, $4, $5, $6
            where not exists (
              select 1 from app_public.projects where organization_id = $1
            )
            returning id, slug
          `,
          [
            organizationId,
            organization.user_id,
            isChurch ? "Sunday Service (Sample)" : "Sample project",
            slug,
            targetDate ?? null,
            document,
          ],
        );

        if (project) {
          logger.info(
            { projectId: project.id, organizationId },
            "Created sample project",
          );
        }

        return {
          projectId: project?.id ?? null,
          projectSlug: project?.slug ?? null,
        };
      },
    },
  },
}));
