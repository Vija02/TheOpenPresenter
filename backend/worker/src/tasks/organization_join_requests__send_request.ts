import { Task } from "graphile-worker";

import { SendEmailPayload } from "./send_email";

interface OrganizationJoinRequestsSendRequestPayload {
  /**
   * request id
   */
  id: string;
}

const task: Task = async (inPayload, { addJob, withPgClient }) => {
  const payload: OrganizationJoinRequestsSendRequestPayload = inPayload as any;
  const { id: requestId } = payload;
  const {
    rows: [joinRequest],
  } = await withPgClient((pgClient) =>
    pgClient.query(
      `
        select *
        from app_public.organization_join_requests
        where id = $1
      `,
      [requestId],
    ),
  );
  if (!joinRequest) {
    console.error("Request not found; aborting");
    return;
  }

  const { user, primaryEmail, organization } = await withPgClient(
    async (pgClient) => {
      const {
        rows: [user],
      } = await pgClient.query(`select * from app_public.users where id = $1`, [
        joinRequest.user_id,
      ]);

      // Send to the owner of the organization
      const {
        rows: [primaryEmail],
      } = await pgClient.query(
        `select app_public.users_primary_email(u) from 
          app_public.organizations o 
          join app_public.organization_memberships om on o.id = om.organization_id 
          join app_public.users u on om.user_id = u.id
         where o.id = $1 and is_owner is true`,
        [joinRequest.organization_id],
      );

      const {
        rows: [organization],
      } = await pgClient.query(
        `select * from app_public.organizations where id = $1`,
        [joinRequest.organization_id],
      );

      return { user, primaryEmail, organization };
    },
  );

  const sendEmailPayload: SendEmailPayload = {
    options: {
      to: primaryEmail.users_primary_email,
      subject: `Join request for ${organization.name}`,
    },
    template: "organization_join_request.mjml",
    variables: {
      userFullName: user.name,
      organizationName: organization.name,
      link: `${process.env.ROOT_URL}/org/join-organization/accept?id=${encodeURIComponent(
        joinRequest.id,
      )}`,
    },
  };
  await addJob("send_email", sendEmailPayload);
};

module.exports = task;
