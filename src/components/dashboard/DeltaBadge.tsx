import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import type { ComparisonStatus, Currency } from "@/types";

interface DeltaBadgeProps {
  changeAmount: string;
  changePercent: number | null;
  status: ComparisonStatus;
  currency: Currency;
  label?: string;
}

// Direction is never color-alone: arrow + explicit sign carry the meaning so
// it survives without color perception (PRD accessibility guardrail).
export function DeltaBadge({ changeAmount, changePercent, status, currency, label }: DeltaBadgeProps) {
  if (status === "new") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-200">
        {t("dashboard.newBadge")}
      </span>
    );
  }

  const amountNum = Number(changeAmount);
  const isIncrease = amountNum > 0;
  const isDecrease = amountNum < 0;
  const arrow = isIncrease ? "↑" : isDecrease ? "↓" : "→";
  const colorClass = isIncrease ? "text-red-400" : isDecrease ? "text-green-400" : "text-blue-100/60";
  const sign = isIncrease ? "+" : isDecrease ? "-" : "";
  const absAmount = formatAmount(Math.abs(amountNum).toFixed(2), currency);
  const percentText = changePercent !== null ? `${Math.round(Math.abs(changePercent))}% ` : "";

  return (
    <span className={cn("text-xs font-medium whitespace-nowrap", colorClass)}>
      {arrow} {percentText}({sign}
      {absAmount}){label ? ` ${label}` : ""}
    </span>
  );
}
