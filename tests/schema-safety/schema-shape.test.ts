import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDbClient } from "./db-client";

/**
 * Asserts the schema *shape* both migrations establish — RLS enabled,
 * specific policies/constraints by name — against the ephemeral local
 * Postgres `supabase start` boots. This proves a migration applied without
 * error didn't also silently drop RLS or a constraint; row-level behavior
 * (does RLS actually block cross-user access) is tests/integration/'s job,
 * not this suite's.
 */

let db: Client;

beforeAll(async () => {
  db = createDbClient();
  await db.connect();
});

afterAll(async () => {
  await db.end();
});

async function rlsEnabled(table: string): Promise<boolean> {
  const { rows } = await db.query<{ relrowsecurity: boolean }>(
    "select relrowsecurity from pg_class where relname = $1 and relnamespace = 'public'::regnamespace",
    [table],
  );
  return rows[0]?.relrowsecurity ?? false;
}

async function policyNames(table: string): Promise<string[]> {
  const { rows } = await db.query<{ policyname: string }>(
    "select policyname from pg_policies where schemaname = 'public' and tablename = $1",
    [table],
  );
  return rows.map((row) => row.policyname);
}

describe("row-level security is enabled", () => {
  it("is enabled on public.categories", async () => {
    expect(await rlsEnabled("categories")).toBe(true);
  });

  it("is enabled on public.expenses", async () => {
    expect(await rlsEnabled("expenses")).toBe(true);
  });
});

describe("expected policies exist by name", () => {
  it("categories has select_own and insert_own", async () => {
    expect(await policyNames("categories")).toEqual(
      expect.arrayContaining(["categories_select_own", "categories_insert_own"]),
    );
  });

  it("expenses has select_own, insert_own, update_own, delete_own", async () => {
    expect(await policyNames("expenses")).toEqual(
      expect.arrayContaining([
        "expenses_select_own",
        "expenses_insert_own",
        "expenses_update_own",
        "expenses_delete_own",
      ]),
    );
  });
});

describe("expected constraints exist", () => {
  it("categories_user_id_normalized_name_key unique index exists", async () => {
    const { rows } = await db.query(
      "select indexname from pg_indexes where schemaname = 'public' and tablename = 'categories' and indexname = 'categories_user_id_normalized_name_key'",
    );
    expect(rows).toHaveLength(1);
  });

  it("categories_user_id_id_key unique constraint exists", async () => {
    const { rows } = await db.query(
      "select conname from pg_constraint where conname = 'categories_user_id_id_key' and contype = 'u'",
    );
    expect(rows).toHaveLength(1);
  });

  it("expenses_user_category_fk composite foreign key exists", async () => {
    const { rows } = await db.query(
      "select conname from pg_constraint where conname = 'expenses_user_category_fk' and contype = 'f'",
    );
    expect(rows).toHaveLength(1);
  });
});

describe("expected views exist", () => {
  it("public.monthly_category_summary exists", async () => {
    const { rows } = await db.query(
      "select table_name from information_schema.views where table_schema = 'public' and table_name = 'monthly_category_summary'",
    );
    expect(rows).toHaveLength(1);
  });
});
