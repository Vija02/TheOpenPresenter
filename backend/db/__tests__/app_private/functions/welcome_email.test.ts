import { PoolClient } from "pg";
import { beforeEach, describe, expect, it } from "vitest";

import {
  becomeRoot,
  becomeUser,
  clearEmails,
  clearJobs,
  createUsers,
  getEmails,
  getJobs,
  runJobs,
  withRootDb,
} from "../../helpers";

const TASK = "user__send_welcome_email";

/** The welcome job is delayed 30 minutes; pull it forward so it runs now */
const makeWelcomeJobsDue = (client: PoolClient) =>
  client.query(
    `update graphile_worker._private_jobs set run_at = now()
     where task_id = (select id from graphile_worker._private_tasks where identifier = $1)`,
    [TASK],
  );

const runWelcome = async (client: PoolClient) => {
  await becomeRoot(client);
  await makeWelcomeJobsDue(client);
  // First run sends the welcome task, which queues send_email
  await runJobs(client);
  await runJobs(client);
};

describe("welcome email", () => {
  beforeEach(() => clearEmails());

  it("is queued 30 minutes after signing up with a verified email", () =>
    withRootDb(async (client) => {
      await clearJobs(client);
      const [user] = await createUsers(client, 1, true);

      const jobs = await getJobs(client, TASK);
      expect(jobs).toHaveLength(1);
      expect(jobs[0].payload).toEqual({ id: user.id });
      const delayMinutes =
        (new Date(jobs[0].run_at).getTime() - Date.now()) / 60000;
      expect(delayMinutes).toBeGreaterThan(29);
      expect(delayMinutes).toBeLessThanOrEqual(30);
    }));

  it("is queued when an unverified user verifies, and only once", () =>
    withRootDb(async (client) => {
      await clearJobs(client);
      const [user] = await createUsers(client, 1, false);
      expect(await getJobs(client, TASK)).toHaveLength(0);

      await client.query(
        "update app_public.user_emails set is_verified = true where user_id = $1",
        [user.id],
      );
      expect(await getJobs(client, TASK)).toHaveLength(1);

      // Verifying another address later doesn't queue it again
      await client.query(
        "insert into app_public.user_emails (user_id, email, is_verified) values ($1, 'second@b.c', true)",
        [user.id],
      );
      expect(await getJobs(client, TASK)).toHaveLength(1);
    }));

  it("sends a welcome with unsubscribe links, only once", () =>
    withRootDb(async (client) => {
      await clearJobs(client);
      const [user] = await createUsers(client, 1, true);
      await becomeUser(client, user.id);
      await client.query(
        "select app_public.create_organization('welcome-church', 'Welcome Church', 'church')",
      );

      await runWelcome(client);

      const emails = getEmails();
      expect(emails).toHaveLength(1);
      const [email] = emails;
      expect(email.envelope.to).toEqual([user._email]);
      const message = JSON.parse(email.message);
      expect(message.subject).toEqual("Welcome to TheOpenPresenter");
      expect(message.html).toContain("Thanks for signing up!");
      expect(message.html).toContain("kids&#39; room");
      expect(message.html).toContain(
        `${process.env.ROOT_URL}/unsubscribe?token=`,
      );
      expect(message.headers["List-Unsubscribe-Post"]).toEqual(
        "List-Unsubscribe=One-Click",
      );
      expect(message.headers["List-Unsubscribe"]).toContain(
        `${process.env.ROOT_URL}/email/unsubscribe?token=`,
      );

      // Even if the job somehow runs again, no second email
      clearEmails();
      await client.query(
        "select graphile_worker.add_job($1, json_build_object('id', $2::uuid))",
        [TASK, user.id],
      );
      await runWelcome(client);
      expect(getEmails()).toHaveLength(0);
    }));

  it("uses general wording for people who aren't in a church", () =>
    withRootDb(async (client) => {
      await clearJobs(client);
      await createUsers(client, 1, true);

      await runWelcome(client);

      const [email] = getEmails();
      const message = JSON.parse(email.message);
      expect(message.html).toContain("Do a test run before your next event");
      expect(message.html).not.toContain("kids&#39; room");
    }));

  it("isn't sent to people who unsubscribed", () =>
    withRootDb(async (client) => {
      await clearJobs(client);
      const [user] = await createUsers(client, 1, true);
      await becomeUser(client, user.id);
      await client.query(
        "select app_public.set_my_email_subscription('onboarding', false)",
      );

      await runWelcome(client);

      expect(getEmails()).toHaveLength(0);
      const { rows } = await client.query(
        "select * from app_private.user_lifecycle_emails where user_id = $1",
        [user.id],
      );
      expect(rows).toHaveLength(0);
    }));
});
