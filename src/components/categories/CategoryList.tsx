import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { t } from "@/i18n";
import type { Category } from "@/types";

interface CategoryListProps {
  categories: Category[];
  onEdit: (category: Category) => void;
  onDelete: (id: string) => Promise<void>;
}

const actionButtonClassName =
  "rounded-lg border border-white/10 bg-white/5 p-2 text-blue-100/80 transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400";

export function CategoryList({ categories, onEdit, onDelete }: CategoryListProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (categories.length === 0) {
    return <p className="text-sm text-blue-100/50">{t("common.noCategoriesYet")}</p>;
  }

  async function handleConfirmDelete(id: string) {
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  }

  return (
    <ul className="space-y-2">
      {categories.map((category) => (
        <li key={category.id} className="flex items-stretch gap-2">
          <a
            href={`/expenses?category=${category.id}`}
            className="block flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
          >
            <p className="font-medium text-white">{category.name}</p>
            <p className="text-sm text-blue-100/60">{category.description}</p>
          </a>

          {confirmingId === category.id ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleConfirmDelete(category.id)}
                disabled={deletingId === category.id}
                className="rounded-lg border border-red-500/30 bg-red-900/40 px-3 py-2 text-sm font-medium text-red-200 transition-colors hover:bg-red-900/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                {deletingId === category.id ? t("common.deleting") : t("common.confirm")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingId(null);
                }}
                disabled={deletingId === category.id}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-blue-100/80 transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
              >
                {t("common.cancel")}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={t("category.ariaEdit", { name: category.name })}
                onClick={() => {
                  onEdit(category);
                }}
                className={actionButtonClassName}
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                aria-label={t("category.ariaDelete", { name: category.name })}
                onClick={() => {
                  setConfirmingId(category.id);
                }}
                className={actionButtonClassName}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
