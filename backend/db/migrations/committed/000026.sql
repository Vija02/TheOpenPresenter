--! Previous: sha1:971681ff51d76229a367a109d22928f0a3ffcc55
--! Hash: sha1:b79d240154b65f496a921d2326b2b6bd8af6c6c3

--! split: 1-current.sql
select graphile_worker.add_job(
  'upgrade__v1_1_slides_html_routes',
  job_key => 'upgrade__v1_1_slides_html_routes'
);
