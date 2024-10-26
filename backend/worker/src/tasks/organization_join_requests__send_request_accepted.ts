import { Task } from "graphile-worker";

import { SendEmailPayload } from "./send_email";

interface OrganizationJoinRequestsSendRequestAcceptedPayload {
  organization_id: string;
  user_id: string;
}

const task: Task = async (inPayload, { addJob, withPgClient }) => {
  const payload: OrganizationJoinRequestsSendRequestAcceptedPayload =
    inPayload as any;
  const { organization_id, user_id } = payload;

  const { primaryEmail, organization } = await withPgClient(
    async (pgClient) => {
      // Send to the user that requested
      const {
        rows: [primaryEmail],
      } = await pgClient.query(
        `select app_public.users_primary_email(u) from 
          app_public.users u
         where u.id = $1`,
        [user_id],
      );

      const {
        rows: [organization],
      } = await pgClient.query(
        `select * from app_public.organizations where id = $1`,
        [organization_id],
      );

      return { primaryEmail, organization };
    },
  );

  const sendEmailPayload: SendEmailPayload = {
    options: {
      to: primaryEmail.users_primary_email,
      subject: `You are now part of ${organization.name}`,
    },
    template: "organization_join_request_accepted.mjml",
    variables: {
      organizationName: organization.name,
      link: `${process.env.ROOT_URL}/o/${organization.slug}`,
    },
  };
  await addJob("send_email", sendEmailPayload);
};

module.exports = task;
