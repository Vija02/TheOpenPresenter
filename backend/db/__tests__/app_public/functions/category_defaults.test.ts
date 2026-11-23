import { PoolClient } from "pg";
import { describe, expect, it } from "vitest";

import {
  becomeRoot,
  becomeUser,
  createOrganizations,
  createUsers,
  withRootDb,
} from "../../helpers";

let seq = 0;
const unique = (prefix: string) => `${prefix}-${++seq}`;

const setup = async (client: PoolClient) => {
  const [user, outsider] = await createUsers(client, 2);
  await becomeUser(client, user.id);
  const [org] = await createOrganizations(client, 1);
  await becomeUser(client, outsider.id);
  const {
    rows: [otherOrg],
  } = await client.query(
    `select * from app_public.create_organization($1, 'Other')`,
    [unique("other-org")],
  );
  await becomeRoot(client);

  const {
    rows: [template],
  } = await client.query(
    `insert into app_public.projects (organization_id, slug, name, document)
     values ($1, $2, 'Template', '\\x0102'::bytea) returning id`,
    [org.id, unique("template")],
  );
  const {
    rows: [media],
  } = await client.query(
    `insert into app_public.medias (organization_id, media_name, file_size, file_offset, is_complete, original_name, file_extension)
     values ($1, $2, 1, 1, true, 'a.png', 'png') returning id`,
    [org.id, unique("media") + ".png"],
  );
  await client.query(
    `insert into app_public.project_medias (project_id, media_id, plugin_id) values ($1, $2, gen_random_uuid())`,
    [template.id, media.id],
  );
  const {
    rows: [category],
  } = await client.query(
    `insert into app_public.categories (organization_id, name) values ($1, $2) returning id`,
    [org.id, unique("Sunday")],
  );

  return { user, outsider, org, otherOrg, template, media, category };
};

const createFull = (
  client: PoolClient,
  orgId: string,
  categoryId: string | null,
  templateId: string | null,
) =>
  client.query(
    `select * from app_public.create_full_project($1, '', $2, '{}', $3, null, $4)`,
    [orgId, unique("project"), categoryId, templateId],
  );

describe("category defaults", () => {
  it("lets members set a schedule and default project", () =>
    withRootDb(async (client) => {
      const { user, category, template } = await setup(client);
      await becomeUser(client, user.id);
      const {
        rows: [row],
      } = await client.query(
        `update app_public.categories
         set recurrence = 'FREQ=WEEKLY;INTERVAL=2;BYDAY=SU',
             recurrence_anchor = '2026-11-15',
             start_time = '10:30',
             duration_minutes = 90,
             template_project_id = $2
         where id = $1
         returning recurrence, start_time, duration_minutes, template_project_id`,
        [category.id, template.id],
      );
      expect(row).toEqual({
        recurrence: "FREQ=WEEKLY;INTERVAL=2;BYDAY=SU",
        start_time: "10:30:00",
        duration_minutes: 90,
        template_project_id: template.id,
      });
    }));

  it("rejects a default project from another organization", () =>
    withRootDb(async (client) => {
      const { otherOrg, category } = await setup(client);
      const {
        rows: [foreign],
      } = await client.query(
        `insert into app_public.projects (organization_id, slug, name) values ($1, $2, '') returning id`,
        [otherOrg.id, unique("foreign")],
      );
      await expect(
        client.query(
          `update app_public.categories set template_project_id = $2 where id = $1`,
          [category.id, foreign.id],
        ),
      ).rejects.toMatchObject({ code: "CRORG" });
    }));

  it("clears the default project when it is deleted", () =>
    withRootDb(async (client) => {
      const { category, template } = await setup(client);
      await client.query(
        `update app_public.categories set template_project_id = $2 where id = $1`,
        [category.id, template.id],
      );
      await client.query(`delete from app_public.projects where id = $1`, [
        template.id,
      ]);
      const {
        rows: [row],
      } = await client.query(
        `select template_project_id from app_public.categories where id = $1`,
        [category.id],
      );
      expect(row.template_project_id).toBeNull();
    }));

  it("creates a project as a copy of the template", () =>
    withRootDb(async (client) => {
      const { user, org, category, template, media } = await setup(client);
      await becomeUser(client, user.id);
      const {
        rows: [project],
      } = await createFull(client, org.id, category.id, template.id);
      expect(project.category_id).toBe(category.id);

      await becomeRoot(client);
      const {
        rows: [copy],
      } = await client.query(
        `select encode(document, 'hex') as doc from app_public.projects where id = $1`,
        [project.id],
      );
      expect(copy.doc).toBe("0102");
      const { rows: medias } = await client.query(
        `select media_id from app_public.project_medias where project_id = $1`,
        [project.id],
      );
      expect(medias).toEqual([{ media_id: media.id }]);
    }));

  it("creates a blank project without a template", () =>
    withRootDb(async (client) => {
      const { user, org } = await setup(client);
      await becomeUser(client, user.id);
      const {
        rows: [project],
      } = await createFull(client, org.id, null, null);
      expect(project.document).toBeNull();
    }));

  it("creates a blank project when the template was deleted", () =>
    withRootDb(async (client) => {
      const { user, org, category, template } = await setup(client);
      await client.query(`delete from app_public.projects where id = $1`, [
        template.id,
      ]);
      await becomeUser(client, user.id);
      const {
        rows: [project],
      } = await createFull(client, org.id, category.id, template.id);
      expect(project.category_id).toBe(category.id);
      expect(project.document).toBeNull();
    }));

  it("refuses to copy a project the user can't access", () =>
    withRootDb(async (client) => {
      const { outsider, org, template } = await setup(client);
      await becomeUser(client, outsider.id);
      await expect(
        createFull(client, org.id, null, template.id),
      ).rejects.toBeTruthy();
    }));

  it("refuses to copy a template from another organization", () =>
    withRootDb(async (client) => {
      const { outsider, otherOrg, template } = await setup(client);
      await becomeUser(client, outsider.id);
      await expect(
        createFull(client, otherOrg.id, null, template.id),
      ).rejects.toMatchObject({ code: "NTFND" });
    }));
});
