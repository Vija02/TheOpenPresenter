--! Previous: sha1:352a8a7074c3c6fa5c0f1abb7aed6ecc651e9334
--! Hash: sha1:1f171afc048b064e0b46333f02714a0ca10fa9c6

--! split: 1-current.sql
-- Enter migration here

--! split: 100-reset.sql
alter table app_public.users
  drop column if exists onboarding_data;

--! split: 300-user-onboarding.sql
-- Onboarding
alter table app_public.users
  add column onboarding_data jsonb not null default '{}'::jsonb;

grant update(onboarding_data) on app_public.users to :DATABASE_VISITOR;

comment on column app_public.users.onboarding_data is
  E'Answers given during onboarding, and which steps are done.';
