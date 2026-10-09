--! Previous: sha1:3b435cc7d15f78cc5db94ccc16a9c9ea30d4f6cf
--! Hash: sha1:f46def400587086c7d10f28281673dee961ca94f

--! split: 100-current.sql
select graphile_worker.add_job(
  'upgrade__v1_1_lyrics_full_song_align',
  job_key => 'upgrade__v1_1_lyrics_full_song_align'
);
