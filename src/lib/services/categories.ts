import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Category, CreateCategoryRequest, UpdateCategoryRequest } from "@/types";

const UNIQUE_VIOLATION = "23505";
const FK_VIOLATION = "23503";

export const DEFAULT_CATEGORIES: { name: string; description: string }[] = [
  { name: "Groceries", description: "Food and household supplies" },
  { name: "Transport", description: "Fuel, public transit, parking, vehicle maintenance" },
  { name: "Housing", description: "Rent or mortgage payments" },
  { name: "Utilities", description: "Electricity, water, gas, internet, phone" },
  { name: "Entertainment", description: "Movies, games, hobbies, going out" },
  { name: "Health", description: "Medical, pharmacy, insurance" },
  { name: "Clothing", description: "Apparel and footwear" },
  { name: "Other", description: "Anything that doesn't fit elsewhere" },
];

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(50),
  description: z.string().trim().min(1).max(200),
});

export const updateCategorySchema = createCategorySchema;

export class DuplicateCategoryError extends Error {
  constructor(public readonly existingName: string) {
    super(`A category named '${existingName}' already exists.`);
    this.name = "DuplicateCategoryError";
  }
}

export class CategoryNotFoundError extends Error {
  constructor() {
    super("Category not found.");
    this.name = "CategoryNotFoundError";
  }
}

export class CategoryInUseError extends Error {
  constructor() {
    super("This category still has expenses and cannot be deleted.");
    this.name = "CategoryInUseError";
  }
}

export function normalizeCategoryName(name: string): string {
  return name.trim().toLowerCase();
}

interface CategoryRow {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
  };
}

async function selectCategories(supabase: SupabaseClient, userId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, description, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data as CategoryRow[]).map(toCategory);
}

export async function listCategories(supabase: SupabaseClient, userId: string): Promise<Category[]> {
  const existing = await selectCategories(supabase, userId);
  if (existing.length > 0) return existing;

  const { error } = await supabase
    .from("categories")
    .insert(DEFAULT_CATEGORIES.map((c) => ({ user_id: userId, name: c.name, description: c.description })));

  if (error && error.code !== UNIQUE_VIOLATION) throw error;

  return selectCategories(supabase, userId);
}

// Resolve a 23505 unique-violation into a DuplicateCategoryError that names the
// actual conflicting row (not just the attempted name). Shared by create and
// update so both surface the same message.
async function throwDuplicate(supabase: SupabaseClient, userId: string, attemptedName: string): Promise<never> {
  const normalized = normalizeCategoryName(attemptedName);
  const existing = await selectCategories(supabase, userId);
  const conflicting = existing.find((c) => normalizeCategoryName(c.name) === normalized);
  throw new DuplicateCategoryError(conflicting?.name ?? attemptedName);
}

export async function createCategory(
  supabase: SupabaseClient,
  userId: string,
  input: CreateCategoryRequest,
): Promise<Category> {
  const { data, error } = await supabase
    .from("categories")
    .insert({ user_id: userId, name: input.name, description: input.description })
    .select("id, name, description, created_at")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      await throwDuplicate(supabase, userId, input.name);
    }
    throw error;
  }

  return toCategory(data);
}

export async function updateCategory(
  supabase: SupabaseClient,
  userId: string,
  categoryId: string,
  input: UpdateCategoryRequest,
): Promise<Category> {
  const { data, error } = await supabase
    .from("categories")
    .update({ name: input.name, description: input.description })
    .eq("id", categoryId)
    .eq("user_id", userId)
    .select("id, name, description, created_at")
    .maybeSingle();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      await throwDuplicate(supabase, userId, input.name);
    }
    throw error;
  }
  if (!data) throw new CategoryNotFoundError();

  return toCategory(data);
}

export async function deleteCategory(supabase: SupabaseClient, userId: string, categoryId: string): Promise<void> {
  const { data, error } = await supabase
    .from("categories")
    .delete()
    .eq("id", categoryId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === FK_VIOLATION) throw new CategoryInUseError();
    throw error;
  }
  if (!data) throw new CategoryNotFoundError();
}
