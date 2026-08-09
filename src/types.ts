export interface Category {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface CreateCategoryRequest {
  name: string;
  description: string;
}

export type UpdateCategoryRequest = CreateCategoryRequest;

export interface CreateCategoryResponse {
  category: Category;
}

export interface ListCategoriesResponse {
  categories: Category[];
}

export interface Expense {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string | null;
  amount: string;
  date: string;
  createdAt: string;
}

export interface CreateExpenseRequest {
  categoryId: string;
  name: string | null;
  amount: string;
  date: string;
}

export type UpdateExpenseRequest = CreateExpenseRequest;

export interface ExpenseResponse {
  expense: Expense;
}

export interface ListExpensesResponse {
  expenses: Expense[];
}

export interface MonthlySummaryEntry {
  categoryId: string;
  categoryName: string;
  total: string;
  rank: number;
}

export interface MonthlySummaryResponse {
  summary: MonthlySummaryEntry[];
}

export type ComparisonStatus = "changed" | "new" | "dropped";

export interface CategoryDelta {
  categoryId: string;
  categoryName: string;
  current: string;
  previous: string;
  changeAmount: string;
  changePercent: number | null;
  status: ComparisonStatus;
  rank: number;
}

export interface MonthlyComparison {
  currentTotal: string;
  previousTotal: string;
  totalChangeAmount: string;
  totalChangePercent: number | null;
  categories: CategoryDelta[];
  comparisonAvailable: boolean;
}

export const CURRENCIES = ["USD", "EUR", "GBP", "PLN", "JPY", "CAD", "AUD"] as const;

export type Currency = (typeof CURRENCIES)[number];

export interface UserSettings {
  currency: Currency;
}

export interface UpdateSettingsRequest {
  currency: Currency;
}

export interface SettingsResponse {
  settings: UserSettings;
}

export interface ParseExpensesRequest {
  text: string;
}

export interface ParsedExpenseDraft {
  description: string;
  amount: string;
  categoryId: string | null;
  categoryName: string | null;
}

export interface ParseExpensesResponse {
  items: ParsedExpenseDraft[];
}
