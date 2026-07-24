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
  amount: string;
  date: string;
  createdAt: string;
}

export interface CreateExpenseRequest {
  categoryId: string;
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
