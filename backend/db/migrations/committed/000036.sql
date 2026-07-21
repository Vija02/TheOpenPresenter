--! Previous: sha1:9dfdc39c037c6e748a3bc3d35dd8f102af585bdb
--! Hash: sha1:9eeecdd61211937f20a41bb61e6adc3d964fbf2e

--! split: 1-current.sql
-- Enter migration here
select graphile_worker.add_job('upgrade__v1_simple_image_to_slides');
