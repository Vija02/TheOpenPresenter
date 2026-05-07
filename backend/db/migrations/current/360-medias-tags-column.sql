alter table app_public.medias
  add column if not exists tags text[] not null default '{}';

create index if not exists medias_tags_gin_idx
  on app_public.medias using gin (tags);
