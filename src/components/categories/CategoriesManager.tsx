import { useState } from "react";
import { CategoryList } from "@/components/categories/CategoryList";
import { AddCategoryForm } from "@/components/categories/AddCategoryForm";
import type { Category, CreateCategoryRequest, CreateCategoryResponse } from "@/types";

interface CategoriesManagerProps {
  initialCategories: Category[];
}

export default function CategoriesManager({ initialCategories }: CategoriesManagerProps) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  async function handleCreate(input: CreateCategoryRequest) {
    const response = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (response.status === 409) {
      const body = (await response.json()) as { error: string };
      setDuplicateError(body.error);
      return;
    }

    if (!response.ok) {
      throw new Error("Failed to create category");
    }

    const { category } = (await response.json()) as CreateCategoryResponse;
    setCategories((prev) => [...prev, category]);
    setDuplicateError(null);
  }

  return (
    <div className="space-y-6">
      <CategoryList categories={categories} />
      <AddCategoryForm onCreate={handleCreate} duplicateError={duplicateError} />
    </div>
  );
}
