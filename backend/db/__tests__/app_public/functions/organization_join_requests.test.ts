import { PoolClient } from "pg";
import { expect, it } from "vitest";

import {
  createOrganizations,
  createUsers,
} from "../../../../__tests__/helpers";
import {
  asRoot,
  assertJobComplete,
  becomeRoot,
  becomeUser,
  getEmails,
  getJobs,
  runJobs,
  withRootDb,
  withUserDb,
} from "../../helpers";

async function requestJoinToOrganization(
  client: PoolClient,
  organizationId: string | null | void,
) {
  const {
    rows: [row],
  } = await client.query(
    `
      select * from app_public.request_join_to_organization(
        $1
      )
      `,
    [organizationId],
  );
  return row;
}

async function acceptJoinRequestToOrganization(
  client: PoolClient,
  requestId: string | null | void,
) {
  const {
    rows: [row],
  } = await client.query(
    `
      select * from app_public.accept_join_request_to_organization(
        $1
      )
      `,
    [requestId],
  );
  return row;
}

it("Can request join to organization", () =>
  withUserDb(async (client, user) => {
    const [otherUser] = await asRoot(client, (client) =>
      createUsers(client, 1, true),
    );

    const [organization] = await createOrganizations(client, 1);

    // Action
    await becomeUser(client, otherUser);
    await requestJoinToOrganization(client, organization.id);
    await becomeUser(client, user);

    // Assertions
    const { rows: requests } = await asRoot(client, () =>
      client.query(
        "select * from app_public.organization_join_requests where organization_id = $1 order by id asc",
        [organization.id],
      ),
    );

    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request.user_id).toEqual(otherUser.id);

    const jobs = await getJobs(
      client,
      "organization_join_requests__send_request",
    );
    expect(jobs).toHaveLength(1);
    const [job] = jobs;
    expect(job.payload).toMatchObject({
      id: request.id,
    });

    // Assert that the job can run correctly
    // Run the job
    await runJobs(client);
    await assertJobComplete(client, job);
    // Check that the email was sent
    const emails = getEmails();
    expect(emails).toHaveLength(1);
    const [email] = emails;
    expect(email.envelope.to).toEqual(["a@b.c"]);
    const message = JSON.parse(email.message);
    expect(message.subject).toEqual(`Join request for ${organization.name}`);
    const expectedLink = `${process.env.ROOT_URL}/join-organization/accept?id=${request.id}`;
    expect(message.html).toContain(expectedLink);
  }));

it("Can accept a join request", () =>
  withRootDb(async (client) => {
    // Setup
    const [organizationOwner, requestee] = await createUsers(client, 2, true);
    await becomeUser(client, organizationOwner);
    const [organization] = await createOrganizations(client, 1);
    await becomeUser(client, requestee);
    await requestJoinToOrganization(client, organization.id);
    await becomeRoot(client);
    const {
      rows: [joinRequest],
    } = await client.query(
      `select * from app_public.organization_join_requests order by id desc limit 1`,
    );

    // Action
    await becomeUser(client, organizationOwner);
    await acceptJoinRequestToOrganization(client, joinRequest.id);

    // Assertions
    await becomeRoot(client);
    const {
      rows: [joinRequestShouldntExist],
    } = await client.query(
      `select * from app_public.organization_join_requests where id = $1`,
      [joinRequest.id],
    );
    expect(joinRequestShouldntExist).toBeFalsy();
    const {
      rows: [membership],
    } = await client.query(
      `select * from app_public.organization_memberships where organization_id = $1 and user_id = $2`,
      [organization.id, requestee.id],
    );
    expect(membership).toBeTruthy();
    expect(membership.is_owner).toEqual(false);
    expect(membership.is_billing_contact).toEqual(false);

    const jobs = await getJobs(
      client,
      "organization_join_requests__send_request_accepted",
    );
    expect(jobs).toHaveLength(1);
    const [job] = jobs;
    expect(job.payload).toMatchObject({
      user_id: requestee.id,
      organization_id: organization.id,
    });

    // Assert that the job can run correctly
    // Run the job
    await runJobs(client);
    await assertJobComplete(client, job);
    // Check that the email was sent
    const emails = getEmails();
    expect(emails).toHaveLength(1);
    const [email] = emails;
    expect(email.envelope.to).toEqual(["b1@b.c"]);
    const message = JSON.parse(email.message);
    expect(message.subject).toEqual(`You are now part of ${organization.name}`);
    const expectedLink = `${process.env.ROOT_URL}/o/${organization.slug}`;
    expect(message.html).toContain(expectedLink);
  }));
