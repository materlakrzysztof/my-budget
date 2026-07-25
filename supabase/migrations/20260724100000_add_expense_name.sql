-- Add an optional label to expenses so users can tell entries apart.
-- Purely additive: nullable, no default, no backfill. Existing rows get null.
-- Length (max 100) is enforced at the app layer only, matching the existing
-- convention where categories.description's length cap is Zod-only.
-- No RLS change needed: existing per-row policies already cover the whole row.
alter table public.expenses add column name text;
