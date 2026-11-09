import { sponsorshipEmail } from "@repo/config";
import { Task } from "graphile-worker";

import { SendEmailPayload } from "./send_email";

interface OrganizationSponsorshipsSendApprovedPayload {
  id: string;
}

/**
 * Approval email for sponsorships granted directly with grant_sponsorship
 * (e.g. churches that applied by email). Goes to the organization owner.
 */
const task: Task = async (inPayload, { addJob, withPgClient }) => {
  const payload: OrganizationSponsorshipsSendApprovedPayload = inPayload as any;
  const { id: sponsorshipId } = payload;

  const {
    rows: [sponsorship],
  } = await withPgClient((pgClient) =>
    pgClient.query(
      `
        select
          o.name as organization_name,
          o.slug as organization_slug,
          owner.name as owner_name,
          app_public.users_primary_email(owner) as email
        from app_private.organization_sponsorships s
        join app_public.organizations o on o.id = s.organization_id
        left join lateral (
          select u.*
          from app_public.organization_memberships m
          join app_public.users u on u.id = m.user_id
          where m.organization_id = o.id and m.is_owner
          limit 1
        ) owner on true
        where s.id = $1 and s.ended_at is null
      `,
      [sponsorshipId],
    ),
  );
  if (!sponsorship) {
    console.error("Active sponsorship not found; aborting");
    return;
  }
  if (!sponsorship.email) {
    console.error("No owner email to notify for sponsorship");
    return;
  }

  const sendEmailPayload: SendEmailPayload = {
    options: {
      to: sponsorship.email,
      replyTo: sponsorshipEmail,
      subject: `${sponsorship.organization_name} is now sponsored`,
    },
    template: "sponsorship_approved.mjml",
    variables: {
      applicantName: sponsorship.owner_name ?? "there",
      organizationName: sponsorship.organization_name,
      link: `${process.env.ROOT_URL}/o/${encodeURIComponent(
        sponsorship.organization_slug,
      )}/billing`,
    },
  };
  await addJob("send_email", sendEmailPayload);
};

module.exports = task;
