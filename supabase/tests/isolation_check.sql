-- Read-only check: can a signed-in user see rows that belong to other users?
-- It picks the oldest user, acts as that user for the check, and reports every table that has a
-- user_id column where rows of OTHER users are visible. It changes nothing.
-- The result is shown as an "error" message so it is easy to read in the SQL editor:
--   ISOLATION RESULT: ... other-user rows visible in: none   <- good
do $$
declare
  uid uuid;
  t text;
  n bigint;
  bad text := '';
  users bigint;
  checked int := 0;
begin
  select count(*) into users from auth.users;
  select id into uid from auth.users order by created_at limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  for t in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'user_id'
  loop
    execute format('select count(*) from public.%I where user_id <> $1', t) into n using uid;
    checked := checked + 1;
    if n > 0 then bad := bad || t || ' (' || n || ' rows) '; end if;
  end loop;
  reset role;
  raise exception 'ISOLATION RESULT: % users, % tables checked, other-user rows visible in: %',
    users, checked, coalesce(nullif(bad, ''), 'none');
end $$;
