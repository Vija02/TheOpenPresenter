--! Previous: sha1:ecbfd32a05b31ad04ca5ba0fa5af1001e811880c
--! Hash: sha1:91899300e2065cd08947d3fe5df218d401e445bf

--! split: 1-current.sql
-- Empty function, we don't want to limit the password strength for now.
create or replace function app_private.assert_valid_password(new_password text) returns void as $$
begin
end;
$$ language plpgsql volatile;
