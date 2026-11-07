import { sponsorshipEmail } from "@repo/config";
import { Task } from "graphile-worker";

import { SendEmailPayload } from "./send_email";

interface SponsorshipApplicationsSendApprovedPayload {
  id: string;
}

const task: Task = async (inPayload, { addJob, withPgClient }) => {
  const payload: SponsorshipApplicationsSendApprovedPayload = inPayload as any;
  const { id: applicationId } = payload;

  const {
    rows: [application],
  } = await withPgClient((pgClient) =>
    pgClient.query(
      `
        select
          o.name as organization_name,
          o.slug as organization_slug,
          u.name as applicant_name,
          coalesce(
            app_public.users_primary_email(u),
            (
              -- Applicant's account is gone; fall back to the org owner
              select app_public.users_primary_email(owner)
              from app_public.organization_memberships m
              join app_public.users owner on owner.id = m.user_id
              where m.organization_id = o.id and m.is_owner
              limit 1
            )
          ) as email
        from app_private.sponsorship_applications a
        join app_public.organizations o on o.id = a.organization_id
        left join app_public.users u on u.id = a.user_id
        where a.id = $1 and a.status = 'approved'
      `,
      [applicationId],
    ),
  );
  if (!application) {
    console.error("Approved sponsorship application not found; aborting");
    return;
  }
  if (!application.email) {
    console.error("No email address to notify for sponsorship approval");
    return;
  }

  const sendEmailPayload: SendEmailPayload = {
    options: {
      to: application.email,
      replyTo: sponsorshipEmail,
      subject: `${application.organization_name} is now sponsored`,
    },
    template: "sponsorship_approved.mjml",
    variables: {
      applicantName: application.applicant_name ?? "there",
      organizationName: application.organization_name,
      link: `${process.env.ROOT_URL}/o/${encodeURIComponent(
        application.organization_slug,
      )}/billing`,
    },
  };
  await addJob("send_email", sendEmailPayload);
};

module.exports = task;
