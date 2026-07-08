drop function if exists notify_saved_song_change() cascade;
drop table if exists recent_song;
drop table if exists saved_song;

-- ---------------------------------------------------------------------------
-- Main songbook table
-- ---------------------------------------------------------------------------
create table saved_song (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references app_public.organizations (id) on delete cascade,
  created_by_user_id uuid
    references app_public.users (id) on delete set null,

  -- Searchable song data
  title   text not null,
  author  text,
  album   text,
  content text not null default '',

  -- Import info
  source      text not null default 'manual',
  external_id text,

  -- Full-fidelity snapshots
  song              jsonb not null,
  video_backgrounds jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

/*====================================*/
/*============== Indexes =============*/
/*====================================*/
create index on saved_song (organization_id);
create index on saved_song (created_by_user_id);
-- Browse an org's whole library, most-recently-updated first.
create index on saved_song (organization_id, updated_at desc);
-- Case-insensitive title lookup / search within an org.
create index on saved_song (organization_id, lower(title));

/*====================================*/
/*========= Standard Triggers ========*/
/*====================================*/
-- Timestamps
create trigger _100_timestamps
  before insert or update on saved_song
  for each row
  execute procedure app_private.tg__timestamps();


-- ---------------------------------------------------------------------------
-- Keep track of recently used
-- ---------------------------------------------------------------------------
create table recent_song (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references app_public.organizations (id) on delete cascade,

  saved_song_id uuid
    references saved_song (id) on delete cascade,

  created_at timestamptz not null default now()
);

/*====================================*/
/*============== Indexes =============*/
/*====================================*/
create index on recent_song (organization_id);
-- Most-recently-used first, per org.
create index on recent_song (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Misc.
-- ---------------------------------------------------------------------------

/*=====================================*/
/*============= SUBSCRIBE =============*/
/*=====================================*/
create or replace function notify_saved_song_change() returns trigger as $$
begin
  perform pg_notify(
    'lyrics_presenter_songbook',
    json_build_object(
      'id', NEW.id,
      'organizationId', NEW.organization_id
    )::text
  );
  return NEW;
end;
$$ language plpgsql;

create trigger saved_song_notify
  after insert or update on saved_song
  for each row execute function notify_saved_song_change();
