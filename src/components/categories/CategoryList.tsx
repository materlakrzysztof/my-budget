import type { Category } from "@/types";

interface CategoryListProps {
  categories: Category[];
}

export function CategoryList({ categories }: CategoryListProps) {
  if (categories.length === 0) {
    return <p className="text-sm text-blue-100/50">No categories yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {categories.map((category) => (
        <li key={category.id} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
          <p className="font-medium text-white">{category.name}</p>
          <p className="text-sm text-blue-100/60">{category.description}</p>
        </li>
      ))}
    </ul>
  );
}
