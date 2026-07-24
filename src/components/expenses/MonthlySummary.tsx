import { formatAmount } from "@/lib/format";
import type { Currency, MonthlySummaryEntry } from "@/types";

interface MonthlySummaryProps {
  entries: MonthlySummaryEntry[];
  currency: Currency;
}

export function MonthlySummary({ entries, currency }: MonthlySummaryProps) {
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
            <li key={entry.categoryId} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium text-white">{entry.categoryName}</span>
                <span className="text-sm text-blue-100/80">{formatAmount(entry.total, currency)}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-purple-500" style={{ width: `${widthPercent}%` }} />
              </div>
            </li>
          );
        })}
    </ul>
  );
}
