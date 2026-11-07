import { sponsorshipEmail } from "@repo/config";
import { Task } from "graphile-worker";

import { SendEmailPayload } from "./send_email";

interface SponsorshipApplicationsNotifyPayload {
  id: string;
}

const task: Task = async (inPayload, { addJob, withPgClient }) => {
  const payload: SponsorshipApplicationsNotifyPayload = inPayload as any;
  const { id: applicationId } = payload;

  const {
    rows: [application],
  } = await withPgClient((pgClient) =>
    pgClient.query(
      `
        select
          a.id,
          a.weekly_attendance,
          a.about_church,
          a.intended_use,
          o.name as organization_name,
          o.slug as organization_slug,
          u.name as applicant_name,
          app_public.users_primary_email(u) as applicant_email
        from app_private.sponsorship_applications a
        join app_public.organizations o on o.id = a.organization_id
        left join app_public.users u on u.id = a.user_id
        where a.id = $1
      `,
      [applicationId],
    ),
  );
  if (!application) {
    console.error("Sponsorship application not found; aborting");
    return;
  }

  const sendEmailPayload: SendEmailPayload = {
    options: {
      to: sponsorshipEmail,
      subject: `Sponsorship application: ${application.organization_name}`,
    },
    template: "sponsorship_application.mjml",
    variables: {
      applicationId: application.id,
      organizationName: application.organization_name,
      organizationSlug: application.organization_slug,
      applicantName: application.applicant_name ?? "Unknown",
      applicantEmail: application.applicant_email ?? "Unknown",
      weeklyAttendance: String(application.weekly_attendance),
      aboutChurch: application.about_church,
      intendedUse: application.intended_use ?? "Not given",
    },
  };
  await addJob("send_email", sendEmailPayload);
};

module.exports = task;
