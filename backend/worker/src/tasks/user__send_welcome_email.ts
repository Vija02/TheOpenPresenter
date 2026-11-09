import { projectName, supportEmail } from "@repo/config";
import { Task } from "graphile-worker";

import { getOptionalEmailRecipient } from "../optionalEmail";
import { SendEmailPayload } from "./send_email";

interface UserSendWelcomeEmailPayload {
  id: string;
}

const task: Task = async (inPayload, { addJob, withPgClient }) => {
  const { id: userId } = inPayload as UserSendWelcomeEmailPayload;

  const recipient = await getOptionalEmailRecipient(
    withPgClient,
    userId,
    "onboarding",
  );
  if (!recipient) {
    // Unsubscribed, deleted, or no verified email
    return;
  }

  const { rowCount: claimed } = await withPgClient((pgClient) =>
    pgClient.query(
      `insert into app_private.user_lifecycle_emails (user_id, email_key)
       values ($1, 'welcome')
       on conflict do nothing`,
      [userId],
    ),
  );
  if (!claimed) {
    return;
  }

  const {
    rows: [membership],
  } = await withPgClient((pgClient) =>
    pgClient.query<{ organization_type: string }>(
      `select organizations.organization_type
       from app_public.organization_memberships
       inner join app_public.organizations
         on organizations.id = organization_memberships.organization_id
       where organization_memberships.user_id = $1
       order by organization_memberships.created_at asc
       limit 1`,
      [userId],
    ),
  );
  const isChurch = membership?.organization_type === "church";

  const rootUrl = process.env.ROOT_URL;
  const sendEmailPayload: SendEmailPayload = {
    options: {
      to: recipient.email,
      replyTo: supportEmail,
      subject: `Welcome to ${projectName}`,
      headers: recipient.headers,
    },
    template: "welcome.mjml",
    variables: {
      ...recipient.variables,
      name: recipient.name || recipient.username,
      openLink: `${rootUrl}/o`,
      lowPressureText: isChurch
        ? "Use it at a rehearsal, on a lobby screen or in a kids' room before you put it on the main screen."
        : "Do a test run before your next event, so you know how everything works on the day.",
    },
  };
  await addJob("send_email", sendEmailPayload);
};

export default task;
