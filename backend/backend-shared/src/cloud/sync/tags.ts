import { TagFragment } from "@repo/graphql";

import { WithPgClient } from "../../types";

export type SyncedTag = { id: string; name: string };

// Tags have multiple fields. But we'll only match based on name here. So the style might look different
// if we already have something defined locally that has the same name.
export const syncTags = async (
  withPgClient: WithPgClient,
  organizationId: string,
  requiredTagNames: string[],
  tagDefinitions: TagFragment[],
): Promise<SyncedTag[]> => {
  const requiredNames = Array.from(
    new Set(requiredTagNames.filter((name): name is string => name != null)),
  );

  const tagsMap: SyncedTag[] = [];
  if (requiredNames.length === 0) {
    return tagsMap;
  }

  const { rows: currentTags } = await withPgClient((pgClient) =>
    pgClient.query(
      `
        SELECT id, name FROM app_public.tags
          WHERE name = ANY($1) AND organization_id = $2
      `,
      [requiredNames, organizationId],
    ),
  );
  tagsMap.push(...currentTags);

  const existingNames = new Set(tagsMap.map((tag) => tag.name));
  const missingNames = requiredNames.filter((name) => !existingNames.has(name));

  if (missingNames.length > 0) {
    const missingTagsFullData = missingNames.map(
      (name) => tagDefinitions.find((tag) => tag.name === name)!,
    );

    const { rows: newTags } = await withPgClient((pgClient) =>
      pgClient.query(
        `
          INSERT INTO app_public.tags (name, description, background_color, foreground_color, variant, organization_id)
            SELECT name, description, background_color, foreground_color, variant, organization_id
            FROM jsonb_to_recordset($1) AS t (name text, description text, background_color text, foreground_color text, variant text, organization_id uuid)
          RETURNING id, name
        `,
        [
          JSON.stringify(
            missingTagsFullData.map((tag) => ({
              name: tag.name,
              description: tag.description,
              background_color: tag.backgroundColor,
              foreground_color: tag.foregroundColor,
              variant: tag.variant,
              organization_id: organizationId,
            })),
          ),
        ],
      ),
    );
    tagsMap.push(...newTags);
  }

  return tagsMap;
};
