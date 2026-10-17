--! Previous: sha1:f46def400587086c7d10f28281673dee961ca94f
--! Hash: sha1:35673cd1901665234a79d5d0f89f8ab7474e1d4c

--! split: 1-current.sql
-- Enter migration here

--! split: 100-upgrade-slides-proxy-cache.sql
-- Point already-imported Google Slides at the proxy cache. See
-- backend/worker/src/migrations/slidesProxyCache.ts
select graphile_worker.add_job(
  'upgrade__v1_2_slides_proxy_cache',
  job_key => 'upgrade__v1_2_slides_proxy_cache'
);
