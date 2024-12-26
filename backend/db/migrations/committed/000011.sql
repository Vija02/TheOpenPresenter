--! Previous: sha1:2f60909a7fca08ef4414f392d63c4b2fde5be413
--! Hash: sha1:72c3420fc74901204a750809b13267da92b623ce

--! split: 1-current.sql
ALTER TABLE app_public.medias
  DROP COLUMN IF EXISTS s3_upload_id;

ALTER TABLE app_public.medias
  ADD COLUMN s3_upload_id text null;
