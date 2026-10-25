import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { formatQty } from "@/lib/formula/calc";
import { cn } from "@/lib/utils";

export function KpiCard({
  icon: Icon,
  label,
  value,
  unit,
  hint,
  compact,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  compact?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={cn("card flex min-w-0 flex-col", compact ? "p-4" : "p-5")}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold uppercase leading-snug tracking-wide text-gray-500">{label}</span>
        <span className={cn("flex shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600", compact ? "h-8 w-8" : "h-9 w-9")}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <div className={cn("mt-1 font-bold tabular-nums tracking-tight text-pacific-dark", compact ? "text-2xl" : "text-3xl")}>
        {value}
        {unit && <span className="ml-1 text-sm font-semibold text-gray-500">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
      {children && <div className="mt-3 border-t border-gray-100 pt-2">{children}</div>}
    </div>
  );
}

/** A short name → quantity list inside a KPI card. */
export function KgList({ items, empty }: { items: { name: string; kg: number }[]; empty: string }) {
  if (items.length === 0) return <p className="text-xs text-gray-400">{empty}</p>;
  return (
    <ul className="max-h-32 space-y-1 overflow-y-auto pr-1 text-xs">
      {items.map((i) => (
        <li key={i.name} className="flex items-center justify-between gap-2">
          <span className="truncate text-gray-700" title={i.name}>{i.name}</span>
          <span className="shrink-0 font-semibold tabular-nums text-gray-900">{formatQty(i.kg)} kg</span>
        </li>
      ))}
    </ul>
  );
}

/** A short list of names inside a KPI card. */
export function NameList({ label, names, tone }: { label: string; names: string[]; tone: "new" | "existing" }) {
  if (names.length === 0) return null;
  return (
    <div className="text-xs">
      <span className={cn("font-semibold", tone === "new" ? "text-emerald-700" : "text-gray-600")}>{label}: </span>
      <span className="text-gray-700">{names.join(", ")}</span>
    </div>
  );
}
