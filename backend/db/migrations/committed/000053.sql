--! Previous: sha1:44fab38489cc6fff0d01078945a7f62abcdce71a
--! Hash: sha1:3b435cc7d15f78cc5db94ccc16a9c9ea30d4f6cf

--! split: 1-current.sql
select graphile_worker.add_job(
  'upgrade__v1_lyrics_layout',
  job_key => 'upgrade__v1_lyrics_layout'
);
