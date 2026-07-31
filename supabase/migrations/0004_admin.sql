-- Admin support (audit log). The admin *role* itself is not a table column:
-- it lives in auth.users.raw_app_meta_data ->> 'role', which the user cannot
-- edit and which flows into the JWT automatically (see supabase/admin/README.md).
--
-- Every mutating admin action is recorded here by the `admin` Edge Function,
-- which runs with the service role and so bypasses RLS.

create table if not exists public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users(id) on delete set null,
  actor_email text,
  action      text not null,          -- e.g. 'lecture.create'
  target      text,                   -- id / name / code the action touched
  summary     jsonb,                  -- small, non-sensitive payload snapshot
  created_at  timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);

-- RLS on, no policies: authenticated/anon clients get nothing. Only the service
-- role (used by the admin Edge Function) can read or write this table.
alter table public.admin_audit_log enable row level security;
