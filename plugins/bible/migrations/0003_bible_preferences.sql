drop table if exists bible_preference;

create table bible_preference (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null unique
    references app_public.organizations (id) on delete cascade,

  languages jsonb not null default '[]'::jsonb,
  translation_ids jsonb not null default '[]'::jsonb,
  primary_translation_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index on bible_preference (organization_id);

-- Triggers
create trigger _100_timestamps
  before insert or update on bible_preference
  for each row
  execute procedure app_private.tg__timestamps();
