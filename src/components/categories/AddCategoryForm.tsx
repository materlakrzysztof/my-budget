import React, { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DuplicateCategoryAlert } from "@/components/categories/DuplicateCategoryAlert";
import type { CreateCategoryRequest } from "@/types";

const fieldClassName =
  "border-white/20 bg-white/10 text-white placeholder:text-white/40 focus-visible:border-purple-400 focus-visible:ring-purple-400";

interface AddCategoryFormProps {
  onCreate: (input: CreateCategoryRequest) => Promise<void>;
  duplicateError: string | null;
}

export function AddCategoryForm({ onCreate, duplicateError }: AddCategoryFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
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
      await onCreate({ name, description });
      setName("");
      setDescription("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
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

      <DuplicateCategoryAlert message={duplicateError} />

      <Button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-500"
      >
        <Plus className="size-4" />
        {submitting ? "Adding..." : "Add category"}
      </Button>
    </form>
  );
}
