import { PoolClient } from "pg";
import { expect, it } from "vitest";

import {
  becomeRoot,
  becomeUser,
  clearJobs,
  createUsers,
  getJobs,
  withRootDb,
} from "../../helpers";

async function setupOrg(client: PoolClient) {
  const [owner, member] = await createUsers(client, 2);
  await becomeUser(client, owner.id);
  const {
    rows: [org],
  } = await client.query(
    "select * from app_public.create_organization($1, $2)",
    ["small-church", "Small Church"],
  );
  await becomeRoot(client);
  await client.query(
    "insert into app_public.organization_memberships (organization_id, user_id) values ($1, $2)",
    [org.id, member.id],
  );
  return { owner, member, org };
}

const apply = (client: PoolClient, orgId: string, attendance = 30) =>
  client.query(
    "select app_public.apply_for_sponsorship($1, $2, $3, $4) as ok",
    [orgId, attendance, "A small church plant", "Sunday lyrics"],
  );

async function summaryAs(client: PoolClient, userId: string, orgId: string) {
  await becomeUser(client, userId);
  const {
    rows: [row],
  } = await client.query(
    `select (app_public.organizations_sponsorship_application(o)).*
     from app_public.organizations o where o.id = $1`,
    [orgId],
  );
  await becomeRoot(client);
  return row;
}

it("lets the owner apply, notifies us, and can be approved", () =>
  withRootDb(async (client) => {
    const { owner, member, org } = await setupOrg(client);
    await clearJobs(client);

    expect((await summaryAs(client, owner.id, org.id)).status).toBeNull();

    await becomeUser(client, owner.id);
    const {
      rows: [{ ok }],
    } = await apply(client, org.id);
    expect(ok).toBe(true);
    await becomeRoot(client);

    const jobs = await getJobs(client, "sponsorship_applications__notify");
    expect(jobs).toHaveLength(1);

    // Any member can see the status
    const summary = await summaryAs(client, member.id, org.id);
    expect(summary.status).toBe("pending");
    expect(summary.submitted_at).not.toBeNull();

    const {
      rows: [pending],
    } = await client.query(
      "select * from app_private.sponsorship_applications_pending",
    );
    expect(pending.slug).toBe("small-church");
    expect(pending.weekly_attendance).toBe(30);
    expect(pending.applicant_email).toBe(owner._email);

    const {
      rows: [sponsorship],
    } = await client.query(
      "select * from app_private.approve_sponsorship_application($1)",
      [pending.id],
    );
    expect(sponsorship.organization_id).toBe(org.id);
    expect(sponsorship.note).toBe("Applied with ~30 weekly attendance");

    expect((await summaryAs(client, owner.id, org.id)).status).toBe("approved");

    // Already sponsored, so can't apply again
    await becomeUser(client, owner.id);
    await expect(apply(client, org.id)).rejects.toThrow(/already sponsored/);
  }));

it("can be declined, and the church can apply again", () =>
  withRootDb(async (client) => {
    const { owner, org } = await setupOrg(client);
    await becomeUser(client, owner.id);
    await apply(client, org.id, 80);
    await becomeRoot(client);

    const {
      rows: [pending],
    } = await client.query(
      "select id from app_private.sponsorship_applications_pending",
    );
    const {
      rows: [declined],
    } = await client.query(
      "select * from app_private.decline_sponsorship_application($1, $2)",
      [pending.id, "Over 50 people"],
    );
    expect(declined.status).toBe("declined");
    expect(declined.decision_note).toBe("Over 50 people");
    expect((await summaryAs(client, owner.id, org.id)).status).toBe("declined");

    await becomeUser(client, owner.id);
    await apply(client, org.id, 45);
    await becomeRoot(client);
    expect((await summaryAs(client, owner.id, org.id)).status).toBe("pending");
  }));

it("blocks a second application while one is pending", () =>
  withRootDb(async (client) => {
    const { owner, org } = await setupOrg(client);
    await becomeUser(client, owner.id);
    await apply(client, org.id);
    await expect(apply(client, org.id)).rejects.toThrow(/waiting for review/);
  }));

it("only lets the owner or billing contact apply", () =>
  withRootDb(async (client) => {
    const { member, org } = await setupOrg(client);
    await becomeUser(client, member.id);
    await expect(apply(client, org.id)).rejects.toThrow(
      /owner or billing contact/,
    );
  }));

it("requires a verified email", () =>
  withRootDb(async (client) => {
    const { org } = await setupOrg(client);
    const [unverified] = await createUsers(client, 1, false);
    await becomeUser(client, unverified.id);
    await expect(apply(client, org.id)).rejects.toThrow(/verify/);
  }));

it("hides the application from non-members", () =>
  withRootDb(async (client) => {
    const { owner, org } = await setupOrg(client);
    await becomeUser(client, owner.id);
    await apply(client, org.id);
    await becomeRoot(client);

    const [outsider] = await createUsers(client, 1);
    const summary = await summaryAs(client, outsider.id, org.id);
    expect(summary).toBeUndefined();

    await becomeUser(client, outsider.id);
    await expect(
      client.query("select * from app_private.sponsorship_applications"),
    ).rejects.toThrow(/permission denied/);
  }));

it("emails the church when approved or declined", () =>
  withRootDb(async (client) => {
    const { owner, org } = await setupOrg(client);
    await becomeUser(client, owner.id);
    await apply(client, org.id);
    await becomeRoot(client);
    await clearJobs(client);

    const {
      rows: [first],
    } = await client.query(
      "select id from app_private.sponsorship_applications_pending",
    );
    await client.query(
      "select app_private.decline_sponsorship_application($1)",
      [first.id],
    );
    expect(
      await getJobs(client, "sponsorship_applications__send_approved"),
    ).toHaveLength(0);
    const declinedJobs = await getJobs(
      client,
      "sponsorship_applications__send_declined",
    );
    expect(declinedJobs).toHaveLength(1);
    expect(declinedJobs[0].payload.id).toBe(first.id);

    await becomeUser(client, owner.id);
    await apply(client, org.id);
    await becomeRoot(client);
    const {
      rows: [second],
    } = await client.query(
      "select id from app_private.sponsorship_applications_pending",
    );
    await client.query(
      "select app_private.approve_sponsorship_application($1, '6 months', 'ok')",
      [second.id],
    );
    const jobs = await getJobs(
      client,
      "sponsorship_applications__send_approved",
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0].payload.id).toBe(second.id);
  }));

it("can decline without emailing the church", () =>
  withRootDb(async (client) => {
    const { owner, org } = await setupOrg(client);
    await becomeUser(client, owner.id);
    await apply(client, org.id);
    await becomeRoot(client);
    await clearJobs(client);

    const {
      rows: [pending],
    } = await client.query(
      "select id from app_private.sponsorship_applications_pending",
    );
    await client.query(
      "select app_private.decline_sponsorship_application($1, 'spam', false)",
      [pending.id],
    );
    expect(
      await getJobs(client, "sponsorship_applications__send_declined"),
    ).toHaveLength(0);
  }));
