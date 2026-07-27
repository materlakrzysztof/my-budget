import type { MonthlySummaryEntry } from "@/types";

// Distinct-enough palette for category slices on the dark cosmic background.
// Colors are decorative: the legend and the per-category list carry the
// category name + amount, so color is never the sole signal (accessibility).
export const CATEGORY_COLORS = [
  "#a78bfa", // purple
  "#60a5fa", // blue
  "#34d399", // emerald
  "#fbbf24", // amber
  "#f472b6", // pink
  "#22d3ee", // cyan
  "#fb923c", // orange
  "#c084fc", // violet
];

export function colorForIndex(index: number): string {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

interface SpendingDonutProps {
  // Already filtered to entries with spend > 0, in the order the legend uses.
  entries: MonthlySummaryEntry[];
}

const RADIUS = 60;
const STROKE = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function SpendingDonut({ entries }: SpendingDonutProps) {
  const sum = entries.reduce((acc, e) => acc + Number(e.total), 0);
  if (sum <= 0) return null;

  // Precompute each slice's arc length and its cumulative start offset without
  // mutating an outer variable during render (react-compiler-safe). Category
  // counts are tiny, so the O(n^2) prefix sum is negligible.
  const lengths = entries.map((entry) => (Number(entry.total) / sum) * CIRCUMFERENCE);
  const offsets = lengths.map((_, index) => lengths.slice(0, index).reduce((acc, len) => acc + len, 0));

  return (
    <svg viewBox="0 0 140 140" aria-hidden="true" focusable="false" className="h-40 w-40 shrink-0">
      {/* track */}
      <circle cx="70" cy="70" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={STROKE} />
      <g transform="rotate(-90 70 70)">
        {entries.map((entry, index) => (
          <circle
            key={entry.categoryId}
            cx="70"
            cy="70"
            r={RADIUS}
            fill="none"
            stroke={colorForIndex(index)}
            strokeWidth={STROKE}
            strokeDasharray={`${lengths[index]} ${CIRCUMFERENCE - lengths[index]}`}
            strokeDashoffset={-offsets[index]}
          />
        ))}
      </g>
    </svg>
  );
}
