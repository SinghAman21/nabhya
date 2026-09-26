-- ─────────────────────────────────────────────────────────────────────────────
-- Promote an existing account to superadmin.
--
-- There is deliberately no HTTP route for this: an endpoint that mints platform
-- administrators is a permanent attack surface, and the operation is needed
-- roughly once per environment. Run it against the database instead.
--
--   1. Sign up through the app first - this promotes an existing user, it does
--      not create one. Supabase Auth owns account creation.
--   2. Set the email below.
--   3. Run it:
--        psql "$DIRECT_URL" -v email="you@example.com" \
--          -f packages/db/sql/grant-superadmin.sql
--
--      Or paste it into the Supabase SQL editor after replacing :'email'.
--
-- Safe to run more than once: it inserts the role only when absent.
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on

-- Fallback so the file also works when pasted into a GUI editor with no
-- -v flag. Replace the address here if you are not using psql variables.
\if :{?email}
\else
  \set email 'you@example.com'
\endif

begin;

-- The role row must exist. `pnpm --filter @nabhya/db db:seed` creates it, but
-- this makes the script self-sufficient.
insert into roles (name, description)
values ('superadmin', 'System super administrator')
on conflict (name) do nothing;

-- Fail loudly rather than silently doing nothing when the email is unknown -
-- a typo here is otherwise indistinguishable from success.
do $$
declare
  target_email text := lower(trim(:'email'));
  target_user_id uuid;
  role_id uuid;
begin
  select id into target_user_id from users where lower(email) = target_email;

  if target_user_id is null then
    raise exception
      'No user with email %. Sign up through the app first, then re-run.',
      target_email;
  end if;

  select id into role_id from roles where name = 'superadmin';

  insert into user_roles (user_id, role_id)
  select target_user_id, role_id
  where not exists (
    select 1 from user_roles
    where user_id = target_user_id and role_id = role_id
  );

  raise notice 'Granted superadmin to % (user %)', target_email, target_user_id;
end $$;

commit;

-- Confirm the result.
select
  u.email,
  u.status,
  array_agg(r.name order by r.name) as roles
from users u
join user_roles ur on ur.user_id = u.id
join roles r on r.id = ur.role_id
where lower(u.email) = lower(trim(:'email'))
group by u.email, u.status;
