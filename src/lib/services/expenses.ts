import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { computeComparison, mergeCategoriesWithTotals, previousMonthReferenceDate } from "@/lib/comparison";
import type {
  CreateExpenseRequest,
  Expense,
  MonthlyComparison,
  MonthlySummaryEntry,
  UpdateExpenseRequest,
} from "@/types";

export { computeComparison, mergeCategoriesWithTotals, previousMonthReferenceDate };

const FUTURE_DATE_VIOLATION = "23514";
const CATEGORY_OWNERSHIP_VIOLATION = "23503";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// Column is numeric(12,2): 12 total digits, 2 after the decimal point.
const MAX_AMOUNT = 9999999999.99;

const amountSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Amount must be a positive number with at most 2 decimal places")
  .refine((value) => Number(value) > 0, "Amount must be greater than zero")
  .refine((value) => Number(value) <= MAX_AMOUNT, "Amount must be at most 9,999,999,999.99");

const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .refine((value) => value <= todayIsoDate(), "Date cannot be in the future");

// Optional label. Blank or whitespace-only normalizes to null (not "") at this
// boundary, so both the API route and any future caller get consistent
// behavior. Downstream code checks `name !== null` only — never also "".
const nameSchema = z
  .string()
  .trim()
  .max(100, "Name must be at most 100 characters")
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

export const createExpenseSchema = z.object({
  categoryId: z.uuid(),
  name: nameSchema,
  amount: amountSchema,
  date: dateSchema,
});

export const updateExpenseSchema = createExpenseSchema;

export class FutureDateError extends Error {
  constructor() {
    super("Expense date cannot be in the future.");
    this.name = "FutureDateError";
  }
}

export class InvalidAmountError extends Error {
  constructor() {
    super("Amount must be a positive number within the supported range.");
    this.name = "InvalidAmountError";
  }
}

export class CategoryOwnershipError extends Error {
  constructor() {
    super("The selected category does not belong to this user.");
    this.name = "CategoryOwnershipError";
  }
}

export class ExpenseNotFoundError extends Error {
  constructor() {
    super("Expense not found.");
    this.name = "ExpenseNotFoundError";
  }
}

interface ExpenseRow {
  id: string;
  category_id: string;
  name: string | null;
  amount: string;
  date: string;
  created_at: string;
  categories: { name: string } | null;
}

const EXPENSE_SELECT = "id, category_id, name, amount, date, created_at, categories!expenses_user_category_fk(name)";

function toExpense(row: ExpenseRow): Expense {
  if (!row.categories) {
    // The composite ownership FK guarantees every expense has a category
    // row visible under this same user's RLS — a null embed here means the
    // PostgREST schema cache is stale or the FK's invariant broke, not a
    // legitimate "no category" state worth defaulting through silently.
    throw new Error(`Expense ${row.id} has no resolvable category (category_id: ${row.category_id})`);
  }

  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.categories.name,
    name: row.name,
    amount: row.amount,
    date: row.date,
    createdAt: row.created_at,
  };
}

function mapWriteError(error: PostgrestError): never {
  if (error.code === FUTURE_DATE_VIOLATION) {
    // "23514" (check_violation) is shared by both the amount>0 and the
    // date<=current_date checks on expenses — the constraint name in the
    // error message is the only way to tell which one actually fired.
    if (error.message.includes("expenses_amount_check")) throw new InvalidAmountError();
    throw new FutureDateError();
  }
  if (error.code === CATEGORY_OWNERSHIP_VIOLATION) throw new CategoryOwnershipError();
  throw error;
}

export async function listExpenses(
  supabase: SupabaseClient,
  userId: string,
  filter?: { categoryId?: string },
): Promise<Expense[]> {
  let query = supabase.from("expenses").select(EXPENSE_SELECT).eq("user_id", userId);

  if (filter?.categoryId) {
    query = query.eq("category_id", filter.categoryId);
  }

  const { data, error } = await query.order("date", { ascending: false });

  if (error) throw error;

  return (data as unknown as ExpenseRow[]).map(toExpense);
}

export async function createExpense(
  supabase: SupabaseClient,
  userId: string,
  input: CreateExpenseRequest,
): Promise<Expense> {
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      user_id: userId,
      category_id: input.categoryId,
      name: input.name,
      amount: input.amount,
      date: input.date,
    })
    .select(EXPENSE_SELECT)
    .single();

  if (error) mapWriteError(error);

  return toExpense(data as unknown as ExpenseRow);
}

export async function updateExpense(
  supabase: SupabaseClient,
  userId: string,
  expenseId: string,
  input: UpdateExpenseRequest,
): Promise<Expense> {
  const { data, error } = await supabase
    .from("expenses")
    .update({ category_id: input.categoryId, name: input.name, amount: input.amount, date: input.date })
    .eq("id", expenseId)
    .eq("user_id", userId)
    .select(EXPENSE_SELECT)
    .maybeSingle();

  if (error) mapWriteError(error);
  if (!data) throw new ExpenseNotFoundError();

  return toExpense(data as unknown as ExpenseRow);
}

export async function deleteExpense(supabase: SupabaseClient, userId: string, expenseId: string): Promise<void> {
  const { data, error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expenseId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new ExpenseNotFoundError();
}

async function fetchMonthTotals(
  supabase: SupabaseClient,
  userId: string,
  referenceDate: Date,
): Promise<{ categoryId: string; total: string }[]> {
  const monthStart = `${referenceDate.getUTCFullYear()}-${String(referenceDate.getUTCMonth() + 1).padStart(2, "0")}-01`;

  const { data, error } = await supabase
    .from("monthly_category_summary")
    .select("category_id, total")
    .eq("user_id", userId)
    .eq("month", monthStart);

  if (error) throw error;

  return (data as { category_id: string; total: string }[]).map((t) => ({ categoryId: t.category_id, total: t.total }));
}

async function fetchCategories(supabase: SupabaseClient, userId: string): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase.from("categories").select("id, name").eq("user_id", userId);
  if (error) throw error;
  return data;
}

export async function getMonthlySummary(
  supabase: SupabaseClient,
  userId: string,
  referenceDate: Date = new Date(),
): Promise<MonthlySummaryEntry[]> {
  const [categories, totals] = await Promise.all([
    fetchCategories(supabase, userId),
    fetchMonthTotals(supabase, userId, referenceDate),
  ]);

  return mergeCategoriesWithTotals(categories, totals);
}

export async function getMonthlyComparison(
  supabase: SupabaseClient,
  userId: string,
  referenceDate: Date = new Date(),
): Promise<MonthlyComparison> {
  const previousReferenceDate = previousMonthReferenceDate(referenceDate);

  const [categories, currentTotals, previousTotals] = await Promise.all([
    fetchCategories(supabase, userId),
    fetchMonthTotals(supabase, userId, referenceDate),
    fetchMonthTotals(supabase, userId, previousReferenceDate),
  ]);

  const current = mergeCategoriesWithTotals(categories, currentTotals);
  const previous = mergeCategoriesWithTotals(categories, previousTotals);

  return computeComparison(current, previous);
}
