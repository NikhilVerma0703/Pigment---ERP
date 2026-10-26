import { AlertTriangle } from "lucide-react";
import { StockActions } from "@/components/stock/StockAdjust";
import { formatQty } from "@/lib/formula/calc";
import type { NamedKg, StockRow } from "@/lib/stock/queries";
import { cn } from "@/lib/utils";

const kg = (v: number) => `${formatQty(v)} kg`;

function pctRemaining(s: StockRow): number {
  if (s.totalKg <= 0) return 0;
  return Math.max(0, Math.min(100, (s.remainingKg / s.totalKg) * 100));
}

/** Visual palette: one swatch per pigment with its remaining stock. */
export function StockPalette({ stocks }: { stocks: StockRow[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
      {stocks.map((s) => {
        const short = s.remainingKg < 0;
        return (
          <div key={s.id} className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="flex items-center gap-2.5">
              <span
                className="h-8 w-8 shrink-0 rounded-full border border-black/10 shadow-inner"
                style={{ backgroundColor: s.color }}
                aria-hidden
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-gray-900" title={s.name}>{s.name}</div>
                <div className={cn("text-xs tabular-nums", short ? "font-semibold text-red-600" : "text-gray-600")}>
                  {short ? `Short ${kg(-s.remainingKg)}` : `${kg(s.remainingKg)} left`}
                </div>
              </div>
            </div>
            <div
              className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-gray-100"
              role="meter"
              aria-label={`${s.name} remaining`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(pctRemaining(s))}
            >
              <div className="h-full rounded-full" style={{ width: `${pctRemaining(s)}%`, backgroundColor: s.color }} />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-gray-500">
              <span>Stock {formatQty(s.totalKg)}</span>
              <span>Used {formatQty(s.consumedKg)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Live stock record. Total Stock = Initial + Manual additions/adjustments +
 *  Formula production; Consumed = Daily Production; Remaining = Total − Consumed. */
export function StockTable({ stocks }: { stocks: StockRow[] }) {
  const sum = (f: (s: StockRow) => number) => stocks.reduce((t, s) => t + f(s), 0);
  const num = "px-3 py-2.5 text-right tabular-nums";

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full min-w-[1040px] text-sm">
        <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600">
          <tr>
            <th className="w-14 px-3 py-2 text-left">S.No.</th>
            <th className="px-3 py-2 text-left">Pigment/Color</th>
            <th className="px-3 py-2 text-right">Initial Stock</th>
            <th className="px-3 py-2 text-right">Manual Additions</th>
            <th className="px-3 py-2 text-right">From Formulas</th>
            <th className="px-3 py-2 text-right">Total Stock</th>
            <th className="px-3 py-2 text-right">Consumed</th>
            <th className="px-3 py-2 text-right">Remaining</th>
            <th className="w-32 px-3 py-2 text-left">Remaining %</th>
            <th className="px-3 py-2 text-right"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {stocks.map((s, i) => {
            const short = s.remainingKg < 0;
            return (
              <tr key={s.id}>
                <td className="px-3 py-2.5 text-gray-600">{i + 1}</td>
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-2 font-medium text-gray-900">
                    <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: s.color }} aria-hidden />
                    {s.name}
                  </span>
                </td>
                <td className={cn(num, "text-gray-600")}>{kg(s.initialKg)}</td>
                <td className={cn(num, "text-gray-600")}>{kg(s.manualKg)}</td>
                <td className={cn(num, "text-gray-600")}>{kg(s.formulaKg)}</td>
                <td className={cn(num, "font-medium")}>{kg(s.totalKg)}</td>
                <td className={cn(num, "font-medium")}>{kg(s.consumedKg)}</td>
                <td className={cn(num, "font-semibold", short ? "text-red-600" : "text-gray-900")}>
                  {short && <AlertTriangle className="mr-1 inline h-3.5 w-3.5 -translate-y-px" aria-label="Short" />}
                  {kg(s.remainingKg)}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={cn("h-full rounded-full", short ? "bg-red-500" : "bg-brand-500")}
                        style={{ width: `${short ? 100 : pctRemaining(s)}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs tabular-nums text-gray-600">
                      {short ? "0%" : `${Math.round(pctRemaining(s))}%`}
                    </span>
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <StockActions pigmentId={s.id} name={s.name} />
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-gray-900">
          <tr>
            <td className="px-3 py-2.5" colSpan={2}>Total ({stocks.length} pigments)</td>
            <td className={num}>{kg(sum((s) => s.initialKg))}</td>
            <td className={num}>{kg(sum((s) => s.manualKg))}</td>
            <td className={num}>{kg(sum((s) => s.formulaKg))}</td>
            <td className={num}>{kg(sum((s) => s.totalKg))}</td>
            <td className={num}>{kg(sum((s) => s.consumedKg))}</td>
            <td className={num}>{kg(sum((s) => s.remainingKg))}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function UntrackedNotice({ untracked }: { untracked: NamedKg[] }) {
  if (untracked.length === 0) return null;
  return (
    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <div className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4" aria-hidden /> Used in Daily Production but not on the stock list
      </div>
      <p className="mt-1 text-amber-800">
        Add these with &quot;+ Add&quot; above to track their stock:{" "}
        {untracked.map((u, i) => (
          <span key={u.name}>
            {i > 0 && ", "}
            <span className="font-medium">{u.name}</span> ({kg(u.kg)})
          </span>
        ))}
      </p>
    </div>
  );
}
