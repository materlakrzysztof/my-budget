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
