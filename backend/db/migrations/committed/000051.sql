--! Previous: sha1:6753e0fd86e6fbacbeb5fc75b0b647648dc6e5e2
--! Hash: sha1:09bf66c40208ebb530ea92dfb5502acd821171bc

--! split: 1-current.sql
-- Enter migration here

--! split: 100-upgrade-radio-music-player.sql
select graphile_worker.add_job(
  'upgrade__v1_radio_music_player',
  job_key => 'upgrade__v1_radio_music_player'
);
