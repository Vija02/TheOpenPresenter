import { WithPgClient } from "../../types";

export type SyncedCategory = { id: string; name: string };

export const syncCategories = async (
  withPgClient: WithPgClient,
  organizationId: string,
  categoryNames: string[],
): Promise<SyncedCategory[]> => {
  const requiredNames = Array.from(
    new Set(categoryNames.filter((name): name is string => name != null)),
  );

  const categoriesMap: SyncedCategory[] = [];
  if (requiredNames.length === 0) {
    return categoriesMap;
  }

  const { rows: currentCategories } = await withPgClient((pgClient) =>
    pgClient.query(
      `
        SELECT id, name FROM app_public.categories
          WHERE name = ANY($1) AND organization_id = $2
      `,
      [requiredNames, organizationId],
    ),
  );
  categoriesMap.push(...currentCategories);

  const existingNames = new Set(categoriesMap.map((cat) => cat.name));
  const missingNames = requiredNames.filter((name) => !existingNames.has(name));

  if (missingNames.length > 0) {
    const { rows: newCategories } = await withPgClient((pgClient) =>
      pgClient.query(
        `
          INSERT INTO app_public.categories (name, organization_id)
            SELECT name, $1 FROM unnest($2::text[]) AS name
          RETURNING id, name
        `,
        [organizationId, missingNames],
      ),
    );
    categoriesMap.push(...newCategories);
  }

  return categoriesMap;
};
