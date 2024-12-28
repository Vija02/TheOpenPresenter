--! Previous: sha1:72c3420fc74901204a750809b13267da92b623ce
--! Hash: sha1:3676cd5dbfa2145943acfe42e3462860cef1d35b

--! split: 1-current.sql
ALTER TABLE app_public.medias
  DROP COLUMN IF EXISTS is_complete;

ALTER TABLE app_public.medias
  ADD COLUMN is_complete boolean not null default false;

UPDATE app_public.medias SET is_complete = true;
