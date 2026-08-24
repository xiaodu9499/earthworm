create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table if not exists private.learning_admins (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

revoke all on table private.learning_admins from public, anon, authenticated;
alter table private.learning_admins enable row level security;

insert into private.learning_admins (email)
values ('1499896960@qq.com')
on conflict (email) do nothing;

create or replace function private.is_learning_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, auth, private
as $$
  select exists (
    select 1
    from private.learning_admins as administrator
    join auth.users as account
      on lower(account.email) = administrator.email
    where account.id = auth.uid()
  );
$$;

revoke all on function private.is_learning_admin() from public, anon;
grant execute on function private.is_learning_admin() to authenticated;

create or replace function public.is_learning_admin()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, private
as $$
  select private.is_learning_admin();
$$;

revoke all on function public.is_learning_admin() from public, anon;
grant execute on function public.is_learning_admin() to authenticated;

create or replace function private.get_learning_admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, auth, public, private
as $$
declare
  dashboard jsonb;
begin
  if auth.uid() is null or not private.is_learning_admin() then
    raise insufficient_privilege using message = 'Administrator access required';
  end if;

  with user_rows as (
    select
      account.id as user_id,
      account.email,
      account.created_at,
      account.last_sign_in_at,
      progress.updated_at as progress_updated_at,
      greatest(account.created_at, account.last_sign_in_at, progress.updated_at) as last_active_at,
      case
        when jsonb_typeof(progress.state -> 'progress') = 'object'
          then progress.state -> 'progress'
        else '{}'::jsonb
      end as course_progress,
      progress.state ->> 'recentCourseId' as recent_course_id,
      coalesce(familiarity.unfamiliar_count, 0) as unfamiliar_count,
      coalesce(familiarity.mastered_count, 0) as mastered_count,
      progress.user_id is not null as has_synced_progress
    from auth.users as account
    left join public.learning_progress as progress
      on progress.user_id = account.id
    left join lateral (
      select
        count(*) filter (where entry.value = 'unfamiliar')::integer as unfamiliar_count,
        count(*) filter (where entry.value = 'mastered')::integer as mastered_count
      from jsonb_each_text(
        case
          when jsonb_typeof(progress.state -> 'statementFamiliarity') = 'object'
            then progress.state -> 'statementFamiliarity'
          else '{}'::jsonb
        end
      ) as entry
    ) as familiarity on true
  ),
  summary as (
    select
      count(*)::integer as total_users,
      count(*) filter (where has_synced_progress)::integer as synced_users,
      count(*) filter (
        where last_active_at >= now() - interval '7 days'
      )::integer as active_last_7_days,
      coalesce(sum(unfamiliar_count), 0)::integer as total_unfamiliar,
      coalesce(sum(mastered_count), 0)::integer as total_mastered
    from user_rows
  ),
  recent_users as (
    select *
    from user_rows
    order by last_active_at desc, created_at desc
    limit 200
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'totalUsers', summary.total_users,
      'syncedUsers', summary.synced_users,
      'activeLast7Days', summary.active_last_7_days,
      'totalUnfamiliar', summary.total_unfamiliar,
      'totalMastered', summary.total_mastered,
      'listedUsers', least(summary.total_users, 200)
    ),
    'users', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'userId', recent_users.user_id,
            'email', recent_users.email,
            'createdAt', recent_users.created_at,
            'lastSignInAt', recent_users.last_sign_in_at,
            'progressUpdatedAt', recent_users.progress_updated_at,
            'lastActiveAt', recent_users.last_active_at,
            'courseProgress', recent_users.course_progress,
            'recentCourseId', recent_users.recent_course_id,
            'unfamiliarCount', recent_users.unfamiliar_count,
            'masteredCount', recent_users.mastered_count,
            'hasSyncedProgress', recent_users.has_synced_progress
          )
          order by recent_users.last_active_at desc, recent_users.created_at desc
        )
        from recent_users
      ),
      '[]'::jsonb
    )
  )
  into dashboard
  from summary;

  return dashboard;
end;
$$;

revoke all on function private.get_learning_admin_dashboard() from public, anon;
grant execute on function private.get_learning_admin_dashboard() to authenticated;

create or replace function public.get_learning_admin_dashboard()
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, private
as $$
  select private.get_learning_admin_dashboard();
$$;

revoke all on function public.get_learning_admin_dashboard() from public, anon;
grant execute on function public.get_learning_admin_dashboard() to authenticated;

notify pgrst, 'reload schema';
