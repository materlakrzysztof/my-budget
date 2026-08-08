import { colorForIndex } from "@/components/dashboard/SpendingDonut";
import { DeltaBadge } from "@/components/dashboard/DeltaBadge";
import { formatAmount } from "@/lib/format";
import { t } from "@/i18n";
import type { ComparisonStatus, Currency, MonthlySummaryEntry } from "@/types";

interface MonthlySummaryEntryWithDelta extends MonthlySummaryEntry {
  delta?: {
    changeAmount: string;
    changePercent: number | null;
    status: ComparisonStatus;
  };
}

interface MonthlySummaryProps {
  entries: MonthlySummaryEntryWithDelta[];
  currency: Currency;
}

export function MonthlySummary({ entries, currency }: MonthlySummaryProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-blue-100/50">{t("common.noCategoriesYet")}</p>;
  }

  const maxTotal = Math.max(...entries.map((entry) => Number(entry.total)));

  return (
    <ul className="space-y-2">
      {entries
        .slice()
        .sort((a, b) => a.rank - b.rank)
        .map((entry, index) => {
          const widthPercent = maxTotal > 0 ? (Number(entry.total) / maxTotal) * 100 : 0;

          return (
            <li key={entry.categoryId}>
              <a
                href={`/expenses?category=${entry.categoryId}`}
                className="block rounded-lg border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 font-medium text-white">
                    <span
                      aria-hidden="true"
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: colorForIndex(index) }}
                    />
                    <span>{entry.categoryName}</span>
                  </span>
                  <span className="flex items-center gap-2 text-sm text-blue-100/80">
                    <span>{formatAmount(entry.total, currency)}</span>
                    {entry.delta && (
                      <DeltaBadge
                        changeAmount={entry.delta.changeAmount}
                        changePercent={entry.delta.changePercent}
                        status={entry.delta.status}
                        currency={currency}
                      />
                    )}
                  </span>
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
