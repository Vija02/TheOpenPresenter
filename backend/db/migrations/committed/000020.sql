--! Previous: sha1:2a7818516087a6e95fad543016d58b2aec53b34e
--! Hash: sha1:644b2667fd5ca5c64a6f22a57c53bec8c6b1d947

--! split: 1-current.sql
alter table app_public.organization_active_devices 
  drop column if exists host_session_cookie;

-- Cookie to authenticate the request on the host's server.
alter table app_public.organization_active_devices 
  add column host_session_cookie text;

-- Grants
grant insert(host_session_cookie) on app_public.organization_active_devices to :DATABASE_VISITOR;
grant update(host_session_cookie) on app_public.organization_active_devices to :DATABASE_VISITOR;
