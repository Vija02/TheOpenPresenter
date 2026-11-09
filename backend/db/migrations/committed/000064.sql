--! Previous: sha1:a347c6f9a0f4e994e24a6170c8ff55c7d5fa0c9c
--! Hash: sha1:3981b9f2e72e30ff5cb375bee0d9409bf5dc88b1

--! split: 100-reset.sql
-- Drops everything the rest of this migration creates, in reverse-dependency
-- order, so the whole batch is re-runnable.

drop trigger if exists _900_queue_welcome_email on app_public.users;
drop function if exists app_private.tg_users__queue_welcome_email();
drop table if exists app_private.user_lifecycle_emails;

--! split: 300-lifecycle-emails.sql
-- Track those that has been sent
create table app_private.user_lifecycle_emails (
  user_id uuid not null references app_public.users on delete cascade,
  email_key text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, email_key)
);
comment on table app_private.user_lifecycle_emails is 'Lifecycle emails (e.g. welcome) already sent to each user.';

--! split: 900-welcome-email.sql
-- Queue the welcome email 30m after a user first becomes verified
create function app_private.tg_users__queue_welcome_email() returns trigger as $$
begin
  perform graphile_worker.add_job(
    'user__send_welcome_email',
    json_build_object('id', NEW.id),
    run_at := now() + interval '30 minutes',
    job_key := 'user__send_welcome_email:' || NEW.id
  );
  return NEW;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;

create trigger _900_queue_welcome_email
  after update of is_verified on app_public.users
  for each row
  when (OLD.is_verified is false and NEW.is_verified is true)
  execute procedure app_private.tg_users__queue_welcome_email();
