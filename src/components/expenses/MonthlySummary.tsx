import type { MonthlySummaryEntry } from "@/types";

interface MonthlySummaryProps {
  entries: MonthlySummaryEntry[];
}

function formatAmount(total: string): string {
  return `$${Number(total).toFixed(2)}`;
}

export function MonthlySummary({ entries }: MonthlySummaryProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-blue-100/50">No categories yet.</p>;
  }

  const maxTotal = Math.max(...entries.map((entry) => Number(entry.total)));

  return (
    <ul className="space-y-2">
      {entries
        .slice()
        .sort((a, b) => a.rank - b.rank)
        .map((entry) => {
          const widthPercent = maxTotal > 0 ? (Number(entry.total) / maxTotal) * 100 : 0;

          return (
            <li key={entry.categoryId}>
              <a
                href={`/expenses?category=${entry.categoryId}`}
                className="block rounded-lg border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium text-white">{entry.categoryName}</span>
                  <span className="text-sm text-blue-100/80">{formatAmount(entry.total)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-purple-500" style={{ width: `${widthPercent}%` }} />
                </div>
              </a>
            </li>
          );
        })}
    </ul>
  );
}
