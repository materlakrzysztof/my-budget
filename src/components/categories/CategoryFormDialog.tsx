import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Category, CreateCategoryRequest } from "@/types";

const fieldClassName =
  "border-white/20 bg-white/10 text-white placeholder:text-white/40 focus-visible:border-purple-400 focus-visible:ring-purple-400";

interface CategoryFormDialogProps {
  open: boolean;
  mode: "add" | "edit";
  editingCategory: Category | null;
  onSubmit: (input: CreateCategoryRequest) => Promise<void>;
  onClose: () => void;
  serverError: string | null;
}

export function CategoryFormDialog({
  open,
  mode,
  editingCategory,
  onSubmit,
  onClose,
  serverError,
}: CategoryFormDialogProps) {
  // Seeded from the edit target. The parent remounts via `key` on mode/target
  // change, so these initial values re-seed without an effect.
  const [name, setName] = useState(() => (mode === "edit" && editingCategory ? editingCategory.name : ""));
  const [description, setDescription] = useState(() =>
    mode === "edit" && editingCategory ? editingCategory.description : "",
  );
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    const next: typeof errors = {};

    if (!name.trim()) {
      next.name = "Name is required";
    }

    if (!description.trim()) {
      next.description = "Description is required";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!validate()) return;

    setSubmitting(true);
    try {
      await onSubmit({ name, description });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="border-white/10 bg-slate-900 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">{mode === "add" ? "Add category" : "Edit category"}</DialogTitle>
          <DialogDescription className="sr-only">
            {mode === "add" ? "Add a new category" : "Edit an existing category"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="category-name" className="mb-1 block text-sm text-blue-100/80">
              Name
            </label>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              placeholder="e.g. Groceries"
              className={fieldClassName}
            />
            {errors.name && <p className="mt-1 text-xs text-red-300">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="category-description" className="mb-1 block text-sm text-blue-100/80">
              Description
            </label>
            <Textarea
              id="category-description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }));
              }}
              placeholder="What belongs in this category?"
              className={fieldClassName}
            />
            {errors.description && <p className="mt-1 text-xs text-red-300">{errors.description}</p>}
          </div>

          {serverError && (
            <p
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-900/30 px-3 py-2 text-sm text-red-300"
            >
              {serverError}
            </p>
          )}

          <DialogFooter>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-500"
            >
              {submitting ? "Saving..." : mode === "add" ? "Add category" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
