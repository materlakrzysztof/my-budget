import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CategoryList } from "@/components/categories/CategoryList";
import { CategoryFormDialog } from "@/components/categories/CategoryFormDialog";
import { DuplicateCategoryAlert } from "@/components/categories/DuplicateCategoryAlert";
import type { Category, CreateCategoryRequest, CreateCategoryResponse } from "@/types";

interface CategoriesManagerProps {
  initialCategories: Category[];
}

type DialogMode = "closed" | "add" | "edit";

export default function CategoriesManager({ initialCategories }: CategoriesManagerProps) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [dialogMode, setDialogMode] = useState<DialogMode>("closed");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  function openAddDialog() {
    setEditingCategory(null);
    setServerError(null);
    setListError(null);
    setDialogMode("add");
  }

  function openEditDialog(category: Category) {
    setEditingCategory(category);
    setServerError(null);
    setListError(null);
    setDialogMode("edit");
  }

  function closeDialog() {
    setDialogMode("closed");
    setEditingCategory(null);
    setServerError(null);
  }

  async function handleSubmit(input: CreateCategoryRequest) {
    const target = dialogMode === "edit" ? editingCategory : null;
    const url = target ? `/api/categories/${target.id}` : "/api/categories";
    const method = target ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (response.status === 409) {
      const body = (await response.json()) as { error: string };
      setServerError(body.error);
      return;
    }

    if (!response.ok) {
      setServerError(
        target ? "Failed to update category. Please try again." : "Failed to create category. Please try again.",
      );
      return;
    }

    const { category } = (await response.json()) as CreateCategoryResponse;
    setCategories((prev) => (target ? prev.map((c) => (c.id === category.id ? category : c)) : [...prev, category]));
    closeDialog();
  }

  async function handleDelete(id: string) {
    const response = await fetch(`/api/categories/${id}`, { method: "DELETE" });

    if (response.status === 409) {
      const body = (await response.json()) as { error: string };
      setListError(body.error);
      return;
    }

    if (!response.ok) {
      throw new Error("Failed to delete category");
    }

    setCategories((prev) => prev.filter((c) => c.id !== id));
    setListError(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Your categories</h2>
        <Button
          type="button"
          onClick={openAddDialog}
          className="rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-500"
        >
          Add category
        </Button>
      </div>

      <DuplicateCategoryAlert message={listError} />

      <CategoryList categories={categories} onEdit={openEditDialog} onDelete={handleDelete} />

      <CategoryFormDialog
        key={`${dialogMode}-${editingCategory?.id ?? "new"}`}
        open={dialogMode !== "closed"}
        mode={dialogMode === "edit" ? "edit" : "add"}
        editingCategory={editingCategory}
        onSubmit={handleSubmit}
        onClose={closeDialog}
        serverError={serverError}
      />
    </div>
  );
}
