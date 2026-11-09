import { PoolClient } from "pg";
import { expect, it } from "vitest";

import {
  assertJobComplete,
  becomeRoot,
  becomeUser,
  clearJobs,
  createUsers,
  getEmails,
  getJobs,
  runJobs,
  withRootDb,
} from "../../helpers";

async function setupOrg(client: PoolClient, slug = "small-church") {
  const [user] = await createUsers(client, 1);
  await becomeUser(client, user.id);
  const {
    rows: [org],
  } = await client.query(
    "select * from app_public.create_organization($1, $2)",
    [slug, "Small Church"],
  );
  await becomeRoot(client);
  return { user, org };
}

async function billingInfoAs(
  client: PoolClient,
  userId: string,
  orgId: string,
) {
  await becomeUser(client, userId);
  const {
    rows: [info],
  } = await client.query(
    `select (app_public.organizations_billing_info(o)).*
     from app_public.organizations o where o.id = $1`,
    [orgId],
  );
  await becomeRoot(client);
  return info;
}

it("gives a sponsored org the Cloud plan and tracks the review date", () =>
  withRootDb(async (client) => {
    const { user, org } = await setupOrg(client);

    const before = await billingInfoAs(client, user.id, org.id);
    expect(before.plan).toBe("free");
    expect(before.is_sponsored).toBe(false);

    const {
      rows: [sp],
    } = await client.query(
      "select * from app_private.grant_sponsorship($1, '6 months', 'Approx 30 people')",
      ["small-church"],
    );
    expect(sp.organization_id).toBe(org.id);
    expect(sp.note).toBe("Approx 30 people");
    expect(sp.ended_at).toBeNull();

    const during = await billingInfoAs(client, user.id, org.id);
    expect(during.plan).toBe("business");
    expect(during.is_sponsored).toBe(true);
    expect(during.effective_room_count).toBe(1);

    // Not due yet
    const {
      rows: [overview],
    } = await client.query(
      "select * from app_private.sponsorships_overview where slug = $1",
      ["small-church"],
    );
    expect(overview.review_due).toBe(false);

    // Pretend the review date has passed
    await client.query(
      "update app_private.organization_sponsorships set started_at = now() - interval '7 months', review_at = now() - interval '1 month'",
    );
    const {
      rows: [due],
    } = await client.query(
      "select * from app_private.sponsorships_overview where review_due",
    );
    expect(due.slug).toBe("small-church");

    // Renewing pushes the review out and appends to the note
    const {
      rows: [renewed],
    } = await client.query(
      "select * from app_private.renew_sponsorship($1, '12 months', 'Still small, renewed')",
      ["small-church"],
    );
    expect(new Date(renewed.review_at).getTime()).toBeGreaterThan(Date.now());
    expect(renewed.note).toBe("Approx 30 people\nStill small, renewed");

    // Ending drops them back to free and keeps the history row
    const {
      rows: [ended],
    } = await client.query("select * from app_private.end_sponsorship($1)", [
      "small-church",
    ]);
    expect(ended.ended_at).not.toBeNull();

    const after = await billingInfoAs(client, user.id, org.id);
    expect(after.plan).toBe("free");
    expect(after.is_sponsored).toBe(false);

    // Can be sponsored again later
    await client.query("select app_private.grant_sponsorship($1)", [
      "small-church",
    ]);
    const { rows: history } = await client.query(
      "select * from app_private.organization_sponsorships where organization_id = $1",
      [org.id],
    );
    expect(history).toHaveLength(2);
  }));

it("refuses to double-grant a sponsorship", () =>
  withRootDb(async (client) => {
    await setupOrg(client);
    await client.query("select app_private.grant_sponsorship($1)", [
      "small-church",
    ]);
    await expect(
      client.query("select app_private.grant_sponsorship($1)", [
        "small-church",
      ]),
    ).rejects.toThrow(/already sponsored/);
  }));

it("errors on an unknown slug", () =>
  withRootDb(async (client) => {
    await expect(
      client.query("select app_private.grant_sponsorship($1)", ["nope"]),
    ).rejects.toThrow(/No organization/);
  }));

it("is not visible to normal users", () =>
  withRootDb(async (client) => {
    const { user } = await setupOrg(client);
    await becomeUser(client, user.id);
    await expect(
      client.query("select * from app_private.organization_sponsorships"),
    ).rejects.toThrow(/permission denied/);
  }));

it("only emails the owner when send_email is true", () =>
  withRootDb(async (client) => {
    const { user, org } = await setupOrg(client);
    await clearJobs(client);

    // Default: no email
    await client.query("select app_private.grant_sponsorship($1)", [
      "small-church",
    ]);
    expect(
      await getJobs(client, "organization_sponsorships__send_approved"),
    ).toHaveLength(0);
    await client.query("select app_private.end_sponsorship($1)", [
      "small-church",
    ]);

    // Opted in: emails the owner the approval email
    const {
      rows: [sp],
    } = await client.query(
      "select * from app_private.grant_sponsorship($1, '12 months', 'Applied by email', true)",
      ["small-church"],
    );
    const [job] = await getJobs(
      client,
      "organization_sponsorships__send_approved",
    );
    expect(job.payload.id).toBe(sp.id);

    await runJobs(client);
    await assertJobComplete(client, job);
    const emails = getEmails();
    expect(emails).toHaveLength(1);
    const [email] = emails;
    expect(email.envelope.to).toEqual([user._email]);
    const message = JSON.parse(email.message);
    expect(message.subject).toEqual(`${org.name} is now sponsored`);
    expect(message.html).toContain(
      `${process.env.ROOT_URL}/o/${org.slug}/billing`,
    );
  }));
