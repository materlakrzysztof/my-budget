-- Categories originally shipped with only select/insert RLS policies
-- (20260721120000_create_categories.sql). Editing (FR-004) and deleting a
-- category need explicit update/delete policies; without them an authenticated
-- update/delete matches 0 rows and silently no-ops. Mirrors the expenses
-- update/delete policies (20260722090000_create_expenses.sql).

create policy "categories_update_own" on public.categories
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "categories_delete_own" on public.categories
  for delete to authenticated
  using (auth.uid() = user_id);
