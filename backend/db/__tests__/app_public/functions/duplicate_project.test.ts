import { describe, expect, it } from "vitest";

import {
  becomeRoot,
  becomeUser,
  createOrganizations,
  createUsers,
  withRootDb,
} from "../../helpers";

describe("duplicate_project", () => {
  it("copies the project with its document, media and tags", () =>
    withRootDb(async (client) => {
      const [user] = await createUsers(client, 1);
      await becomeUser(client, user.id);
      const [org] = await createOrganizations(client, 1);
      await becomeRoot(client);
      const {
        rows: [source],
      } = await client.query(
        `insert into app_public.projects (organization_id, slug, name, document, target_date, target_time)
         values ($1, 'dup-source', 'Sunday', '\\x0102'::bytea, '2026-11-29', '10:30') returning id`,
        [org.id],
      );
      const {
        rows: [media],
      } = await client.query(
        `insert into app_public.medias (organization_id, media_name, file_size, file_offset, is_complete, original_name, file_extension)
         values ($1, 'dup-media.png', 1, 1, true, 'a.png', 'png') returning id`,
        [org.id],
      );
      await client.query(
        `insert into app_public.project_medias (project_id, media_id, plugin_id) values ($1, $2, gen_random_uuid())`,
        [source.id, media.id],
      );
      const {
        rows: [tag],
      } = await client.query(
        `insert into app_public.tags (organization_id, name) values ($1, 'dup-tag') returning id`,
        [org.id],
      );
      await client.query(
        `insert into app_public.project_tags (project_id, tag_id) values ($1, $2)`,
        [source.id, tag.id],
      );

      await becomeUser(client, user.id);
      const {
        rows: [copy],
      } = await client.query(
        `select * from app_public.duplicate_project($1)`,
        [source.id],
      );
      expect(copy).toMatchObject({
        name: "Sunday (copy)",
        slug: "dup-source-copy",
        target_time: "10:30:00",
      });
      // The returned row already has the copied document
      expect(copy.document).toEqual(Buffer.from([1, 2]));

      await becomeRoot(client);
      const { rows: medias } = await client.query(
        `select media_id from app_public.project_medias where project_id = $1`,
        [copy.id],
      );
      expect(medias).toEqual([{ media_id: media.id }]);
      const { rows: tags } = await client.query(
        `select tag_id from app_public.project_tags where project_id = $1`,
        [copy.id],
      );
      expect(tags).toEqual([{ tag_id: tag.id }]);
    }));

  it("refuses a project in another organization", () =>
    withRootDb(async (client) => {
      const [user, outsider] = await createUsers(client, 2);
      await becomeUser(client, user.id);
      const [org] = await createOrganizations(client, 1);
      await becomeRoot(client);
      const {
        rows: [source],
      } = await client.query(
        `insert into app_public.projects (organization_id, slug, name) values ($1, 'dup-private', 'Private') returning id`,
        [org.id],
      );
      await becomeUser(client, outsider.id);
      await expect(
        client.query(`select * from app_public.duplicate_project($1)`, [
          source.id,
        ]),
      ).rejects.toMatchObject({ code: "DNIED" });
    }));
});
