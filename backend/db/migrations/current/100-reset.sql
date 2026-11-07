drop view if exists app_private.sponsorship_applications_pending;
drop function if exists app_private.approve_sponsorship_application(uuid, interval, text);
drop function if exists app_private.decline_sponsorship_application(uuid, text);
drop function if exists app_public.apply_for_sponsorship(uuid, int, text, text);
drop function if exists app_public.organizations_sponsorship_application(app_public.organizations);
drop type if exists app_public.sponsorship_application_summary;
drop table if exists app_private.sponsorship_applications;

drop view if exists app_private.sponsorships_overview;
drop function if exists app_private.grant_sponsorship(citext, interval, text);
drop function if exists app_private.renew_sponsorship(citext, interval, text);
drop function if exists app_private.end_sponsorship(citext, text);
drop function if exists app_public.organizations_billing_info(app_public.organizations) cascade;
drop type if exists app_public.organization_billing_info cascade;
drop table if exists app_private.organization_sponsorships;
