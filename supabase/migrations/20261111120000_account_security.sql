/*
  # Account security: delete my health data, delete my account

  Two functions that only ever act on the signed-in user (auth.uid()):

  - delete_my_health_data(): removes the health records. The account and profile stay.
  - delete_my_account(): removes every row the user owns in public tables, the profile, and the
    login itself in auth.users. Rows in the tables that cascade from auth.users go with it.
    The caller must have signed in within the last 10 minutes (the app asks for the password
    right before calling it), so a long-idle session cannot delete the account.

  Both run with the rights of the function owner (SECURITY DEFINER) with an empty search_path,
  and are not callable by anonymous (signed-out) users.
  Nothing is deleted when this migration is applied; it only creates the two functions.
*/

create or replace function public.delete_my_health_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  t text;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- period_day_logs first: it can reference periods.
  foreach t in array array['period_day_logs', 'daily_logs', 'periods', 'symptoms', 'prediction_audit', 'symptom_alerts', 'chat_history']
  loop
    if to_regclass('public.' || quote_ident(t)) is not null
       and exists (
         select 1 from information_schema.columns c
         where c.table_schema = 'public' and c.table_name = t and c.column_name = 'user_id'
       )
    then
      execute format('delete from public.%I where user_id = $1', t) using uid;
    end if;
  end loop;
end;
$$;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  issued bigint;
  r record;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- Require a recent sign-in (the app re-checks the password just before this call).
  issued := coalesce((auth.jwt() ->> 'iat')::bigint, 0);
  if extract(epoch from now())::bigint - issued > 600 then
    raise exception 'reauth_required' using errcode = '28000';
  end if;

  -- Every public table that has a user_id column, including tables added later.
  for r in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'user_id'
  loop
    execute format('delete from public.%I where user_id = $1', r.table_name) using uid;
  end loop;

  delete from public.profiles where id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_health_data() from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_health_data() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
