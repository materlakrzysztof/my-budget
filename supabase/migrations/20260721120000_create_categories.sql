create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy "categories_select_own" on public.categories
  for select to authenticated
  using (auth.uid() = user_id);

create policy "categories_insert_own" on public.categories
  for insert to authenticated
  with check (auth.uid() = user_id);

create unique index categories_user_id_normalized_name_key
  on public.categories (user_id, lower(trim(name)));
