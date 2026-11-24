import { PoolClient } from "pg";
import { expect, it } from "vitest";

import { becomeRoot, becomeUser, createUsers, withRootDb } from "../../helpers";

let counter = 0;

/** An organization with one font, and optionally a project. */
const createOrgWithFont = async (
  client: PoolClient,
  { project }: { project?: "private" | "public" } = {},
) => {
  const n = ++counter;
  const {
    rows: [org],
  } = await client.query(
    `insert into app_public.organizations (slug, name) values ($1, $2) returning id`,
    [`font-org-${n}-${Date.now()}`, `Font org ${n}`],
  );
  const {
    rows: [media],
  } = await client.query(
    `insert into app_public.medias (media_name, file_offset, organization_id)
     values ($1, 0, $2) returning id`,
    [`font-${n}.css`, org.id],
  );
  await client.query(
    `insert into app_public.media_font_metadata (font_media_id, family, category, source)
     values ($1, $2, 'sans', 'google')`,
    [media.id, `Family ${n}`],
  );
  if (project) {
    await client.query(
      `insert into app_public.projects (organization_id, slug, is_public)
       values ($1, 'p', $2)`,
      [org.id, project === "public"],
    );
  }
  return { orgId: org.id as string, mediaId: media.id as string };
};

const visibleFonts = async (client: PoolClient, orgId: string) => {
  const { rows } = await client.query(
    `select font_media_id from app_public.organization_fonts($1)`,
    [orgId],
  );
  return rows.map((r) => r.font_media_id);
};

it("members see their organization's fonts", () =>
  withRootDb(async (client) => {
    const [user] = await createUsers(client, 1);
    const { orgId, mediaId } = await createOrgWithFont(client);
    await client.query(
      `insert into app_public.organization_memberships (organization_id, user_id) values ($1, $2)`,
      [orgId, user.id],
    );
    await becomeUser(client, user.id);
    expect(await visibleFonts(client, orgId)).toEqual([mediaId]);
  }));

it("others do not see an organization's fonts", () =>
  withRootDb(async (client) => {
    const [user] = await createUsers(client, 1);
    const { orgId } = await createOrgWithFont(client, { project: "private" });
    await becomeUser(client, user.id);
    expect(await visibleFonts(client, orgId)).toEqual([]);
    const { rows } = await client.query(
      `select count(*)::int as n from app_public.media_font_metadata`,
    );
    expect(rows[0].n).toBe(0);
  }));

it("anyone who can see a project sees its organization's fonts", () =>
  withRootDb(async (client) => {
    const shown = await createOrgWithFont(client, { project: "public" });
    const hidden = await createOrgWithFont(client);
    await becomeUser(client, null);
    expect(await visibleFonts(client, shown.orgId)).toEqual([shown.mediaId]);
    expect(await visibleFonts(client, hidden.orgId)).toEqual([]);
    await becomeRoot(client);
  }));
