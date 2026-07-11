drop table if exists translation_chapter;
drop table if exists translation;

-- A user uploaded bible translation
create table translation (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid
    references app_public.organizations (id) on delete cascade,
  created_by_user_id uuid
    references app_public.users (id) on delete set null,

  name         text not null,
  abbreviation text,
  language     text not null default 'en',

  -- Source format:
  --   'zefania' | 'opensong' | 'osis' | 'beblia' | 'usx' | 'manual'
  format     text not null default 'manual',
  book_count int  not null default 0,

  -- Book index in the translation's native language, e.g.
  --   [{ "n": 1, "name": "1. Mose", "abbr": ["1Mo"], "chapters": [31, 25, ...] }, ...]
  -- `n` = canonical 1..66 book number (language-independent key); `name`/`abbr` = native
  -- display strings; `chapters` = verse count per chapter (length = chapter count).
  -- Drives autocomplete and the book/chapter/verse drill-down without shipping verse text.
  books jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index on translation (organization_id);
create index on translation (organization_id, lower(name));

-- Triggers
create trigger _100_timestamps
  before insert or update on translation
  for each row
  execute procedure app_private.tg__timestamps();


-- One row per chapter. `verses` is a JSON array for that chapter:
--   [{ "v": 1, "t": "In the beginning..." }, ...]
create table translation_chapter (
  id uuid primary key default gen_random_uuid(),

  translation_id uuid not null
    references translation (id) on delete cascade,

  -- Denormalized so RLS can gate reads without a join.
  organization_id uuid
    references app_public.organizations (id) on delete cascade,

  book        text not null,
  book_number int  not null,
  chapter     int  not null,

  verses jsonb not null,

  created_at timestamptz not null default now(),

  unique (translation_id, book, chapter)
);

-- Indexes
create index on translation_chapter (organization_id);
-- Ordered listing of a translation's chapters (book order, then chapter).
create index on translation_chapter (translation_id, book_number, chapter);
