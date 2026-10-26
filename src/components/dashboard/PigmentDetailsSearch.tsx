"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { FlaskConical, Loader2, PackageOpen } from "lucide-react";
import { SuggestCombobox } from "@/components/ui/SuggestCombobox";
import type { PigmentDetail } from "@/lib/dashboard/queries";
import { formatQty } from "@/lib/formula/calc";
import { valueSuggestions } from "@/lib/suggestions";
import { cn, nameKey } from "@/lib/utils";

/**
 * Pick a pigment/colour (or formula) from the stock list: shows its current
 * stock and the ingredients of the latest formula saved under that name. The
 * choice lives in ?pigment= so the server reads both from the saved records.
 */
export function PigmentDetailsSearch({ names, detail }: { names: string[]; detail: PigmentDetail | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = params.get("pigment") ?? "";
  const [text, setText] = useState(selected);
  const [pending, startTransition] = useTransition();
  useEffect(() => setText(selected), [selected]);

  const byKey = useMemo(() => new Map(names.map((n) => [nameKey(n), n])), [names]);
  const choose = (value: string) => {
    setText(value);
    const match = byKey.get(nameKey(value));
    if (!match || nameKey(match) === nameKey(selected)) return;
    const q = new URLSearchParams(params.toString());
    q.set("pigment", match);
    startTransition(() => router.replace(`${pathname}?${q}`, { scroll: false }));
  };

  const kg = (v: number) => `${formatQty(v)} kg`;
  const short = (detail?.stock?.remainingKg ?? 0) < 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-sm">
          <label htmlFor="pigment-search" className="field-label">Pigment/Color Name</label>
          <SuggestCombobox
            id="pigment-search"
            value={text}
            onChange={choose}
            suggestions={valueSuggestions(names)}
            placeholder="Search e.g. SW, TiO2, Yellow"
            newLabel="Not on the stock list"
          />
        </div>
        {pending && <Loader2 className="mb-3 h-5 w-5 animate-spin text-brand-500" aria-label="Loading" />}
      </div>

      {!selected ? (
        <p className="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
          Choose a pigment/color to see its current stock and its latest formula.
        </p>
      ) : !detail ? (
        <p className="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
          “{selected}” is not on the stock list and has no saved formula.
        </p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,280px)_1fr]">
          {/* Current stock */}
          <div className={cn("rounded-lg border p-5", short ? "border-red-200 bg-red-50" : "border-brand-200 bg-brand-50")}>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-600">Total Current Stock</div>
            <div className="mt-0.5 text-sm font-semibold text-gray-800">{detail.name}</div>
            {detail.stock ? (
              <>
                <div className={cn("mt-2 text-4xl font-bold tabular-nums tracking-tight", short ? "text-red-700" : "text-pacific-dark")}>
                  {formatQty(detail.stock.remainingKg)}
                  <span className="ml-1 text-lg font-semibold text-gray-500">kg</span>
                </div>
                <dl className="mt-4 space-y-1 border-t border-black/5 pt-3 text-xs">
                  <div className="flex justify-between"><dt className="text-gray-600">Total stock</dt><dd className="font-semibold tabular-nums">{kg(detail.stock.totalKg)}</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-600">of which from formulas</dt><dd className="tabular-nums">{kg(detail.stock.formulaKg)}</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-600">Consumed (production)</dt><dd className="font-semibold tabular-nums">− {kg(detail.stock.consumedKg)}</dd></div>
                </dl>
              </>
            ) : (
              <p className="mt-3 text-sm text-gray-600">Not on the stock list yet.</p>
            )}
          </div>

          {/* Latest formula */}
          <div>
            {detail.formula ? (
              <>
                <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                    <FlaskConical className="h-4 w-4 text-brand-500" aria-hidden /> Latest formula: {detail.name}
                  </h3>
                  <span className="text-xs text-gray-500">
                    S.No. {detail.formula.serialNo} · {format(parseISO(detail.formula.date), "dd MMM yyyy")} · produced{" "}
                    {kg(detail.formula.producedKg)}
                    {detail.formula.timesCreated > 1 && ` · latest of ${detail.formula.timesCreated} times created`}
                  </span>
                </div>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600">
                      <tr>
                        <th className="w-16 px-3 py-2 text-left">S.No.</th>
                        <th className="px-3 py-2 text-left">Pigment/Color Used</th>
                        <th className="px-3 py-2 text-right">Quantity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {detail.formula.items.map((it) => (
                        <tr key={it.lineNo}>
                          <td className="px-3 py-2.5 text-gray-600">{it.lineNo}</td>
                          <td className="px-3 py-2.5 font-medium text-gray-900">{it.name}</td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                            {formatQty(it.quantity)} {it.unit === "GM" ? "gm" : "kg"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center">
                <PackageOpen className="h-7 w-7 text-gray-300" aria-hidden />
                <p className="text-sm text-gray-500">No formula has been created under the name “{detail.name}”.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
