import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CategoryList } from "@/components/categories/CategoryList";
import { CategoryFormDialog } from "@/components/categories/CategoryFormDialog";
import { DuplicateCategoryAlert } from "@/components/categories/DuplicateCategoryAlert";
import { t } from "@/i18n";
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

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    } catch {
      setServerError(
        target ? "Failed to update category. Please try again." : "Failed to create category. Please try again.",
      );
      return;
    }

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
    let response: Response;
    try {
      response = await fetch(`/api/categories/${id}`, { method: "DELETE" });
    } catch {
      setListError("Failed to delete category. Please try again.");
      return;
    }

    if (response.status === 409) {
      const body = (await response.json()) as { error: string };
      setListError(body.error);
      return;
    }

    // 404 = already gone (e.g. deleted in another tab); treat as success.
    if (!response.ok && response.status !== 404) {
      setListError("Failed to delete category. Please try again.");
      return;
    }

    setCategories((prev) => prev.filter((c) => c.id !== id));
    setListError(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{t("category.heading")}</h2>
        <Button
          type="button"
          onClick={openAddDialog}
          className="rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-500"
        >
          {t("category.addButton")}
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
