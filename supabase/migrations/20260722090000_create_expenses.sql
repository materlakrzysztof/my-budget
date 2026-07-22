alter table public.categories add constraint categories_user_id_id_key unique (user_id, id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  date date not null check (date <= current_date),
  created_at timestamptz not null default now(),
  constraint expenses_user_category_fk foreign key (user_id, category_id) references public.categories (user_id, id) on delete restrict
);

alter table public.expenses enable row level security;

create policy "expenses_select_own" on public.expenses
  for select to authenticated using (auth.uid() = user_id);

create policy "expenses_insert_own" on public.expenses
  for insert to authenticated with check (auth.uid() = user_id);

create policy "expenses_update_own" on public.expenses
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "expenses_delete_own" on public.expenses
  for delete to authenticated using (auth.uid() = user_id);

create index expenses_user_id_date_idx on public.expenses (user_id, date);

create view public.monthly_category_summary
  with (security_invoker = true) as
  select
    e.user_id,
    e.category_id,
    date_trunc('month', e.date)::date as month,
    sum(e.amount) as total
  from public.expenses e
  group by e.user_id, e.category_id, date_trunc('month', e.date);
