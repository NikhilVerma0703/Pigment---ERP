"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, CircleSlash, Loader2, MinusCircle } from "lucide-react";
import { toast } from "sonner";
import { setMinStock } from "@/app/stocks-consumption/actions";
import { formatQty } from "@/lib/formula/calc";
import { STATUS_ORDER, stockStatus, type StockStatus } from "@/lib/stock/alerts";
import type { StockRow } from "@/lib/stock/queries";
import { cn } from "@/lib/utils";

const STATUS: Record<StockStatus, { label: string; icon: typeof AlertTriangle; badge: string; row: string }> = {
  out: { label: "Out of Stock", icon: CircleSlash, badge: "bg-red-100 text-red-700", row: "bg-red-50/70" },
  low: { label: "Low Stock", icon: AlertTriangle, badge: "bg-amber-100 text-amber-800", row: "bg-amber-50/70" },
  ok: { label: "In Stock", icon: CheckCircle2, badge: "bg-emerald-50 text-emerald-700", row: "" },
  unset: { label: "No Minimum Set", icon: MinusCircle, badge: "bg-gray-100 text-gray-600", row: "" },
};

const kg = (v: number) => `${formatQty(v)} kg`;

/** Low Stock Alerts — pigments/colours only. The Minimum Stock Level is
 *  edited in place and saved when the field is left or Enter is pressed. */
export function LowStockAlerts({ stocks }: { stocks: StockRow[] }) {
  const rows = stocks
    .map((s) => ({ ...s, status: stockStatus(s.remainingKg, s.minStockKg) }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name));
  const count = (st: StockStatus) => rows.filter((r) => r.status === st).length;

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
        No pigments on the stock list yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Counter status="out" value={count("out")} />
        <Counter status="low" value={count("low")} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Pigment/Color Name</th>
              <th className="px-3 py-2 text-right">Total Stock</th>
              <th className="px-3 py-2 text-right">Consumed</th>
              <th className="px-3 py-2 text-right">Remaining Stock</th>
              <th className="w-44 px-3 py-2 text-right">Minimum Stock Level</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => {
              const st = STATUS[r.status];
              const Icon = st.icon;
              return (
                <tr key={r.id} className={st.row}>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2 font-medium text-gray-900">
                      <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: r.color }} aria-hidden />
                      {r.name}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{kg(r.totalKg)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{kg(r.consumedKg)}</td>
                  <td
                    className={cn(
                      "px-3 py-2.5 text-right font-semibold tabular-nums",
                      r.status === "out" ? "text-red-700" : r.status === "low" ? "text-amber-800" : "text-gray-900",
                    )}
                  >
                    {kg(r.remainingKg)}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <MinStockInput id={r.id} name={r.name} value={r.minStockKg} />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", st.badge)}>
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                      {st.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Counter({ status, value }: { status: "out" | "low"; value: number }) {
  const st = STATUS[status];
  const Icon = st.icon;
  const active = value > 0;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-4 py-3",
        !active
          ? "border-gray-200 bg-white"
          : status === "out"
            ? "border-red-200 bg-red-50"
            : "border-amber-200 bg-amber-50",
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full",
          !active ? "bg-gray-100 text-gray-400" : status === "out" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800",
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div>
        <div className="text-2xl font-bold tabular-nums text-gray-900">{value}</div>
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-600">{st.label}</div>
      </div>
    </div>
  );
}

function MinStockInput({ id, name, value }: { id: string; name: string; value: number | null }) {
  const router = useRouter();
  const initial = value === null ? "" : String(value);
  const [text, setText] = useState(initial);
  const [saving, startSaving] = useTransition();

  const save = () => {
    const next = text.trim();
    if (next === initial) return;
    startSaving(async () => {
      const result = await setMinStock(id, next);
      if (!result.ok) {
        toast.error(result.error);
        setText(initial);
        return;
      }
      toast.success(next === "" ? `Minimum removed for ${name}` : `Minimum for ${name} set to ${formatQty(Number(next))} kg`);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center justify-end gap-1.5">
      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-500" aria-hidden />}
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="Not set"
        aria-label={`Minimum stock level for ${name} in kg`}
        className="field-input w-24 py-1.5 text-right tabular-nums"
        value={text}
        disabled={saving}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setText(initial);
        }}
      />
      <span className="text-xs text-gray-500">kg</span>
    </div>
  );
}
