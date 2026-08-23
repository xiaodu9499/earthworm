create table if not exists public.learning_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

revoke all on table public.learning_progress from anon, authenticated;
grant select, insert, update on table public.learning_progress to authenticated;

alter table public.learning_progress enable row level security;

create policy "Users can read their own learning progress"
on public.learning_progress
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own learning progress"
on public.learning_progress
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own learning progress"
on public.learning_progress
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
