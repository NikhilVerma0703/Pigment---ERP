"use client";

import { useCallback, useState } from "react";
import { format, parseISO } from "date-fns";
import { Inbox } from "lucide-react";
import { deleteFormula } from "@/app/formula-creation/actions";
import { RecordDetailModal } from "@/components/search/RecordDetail";
import { EditDeleteButtons, ReviewButton } from "@/components/ui/RowActions";
import { formatQty } from "@/lib/formula/calc";
import type { LatestFormula } from "@/lib/formula/queries";
import type { DetailRef } from "@/lib/search/types";

/** The latest saved formulas, with Review (read-only overview: every field,
 *  ingredient and the Requirement Table), Edit and Delete. */
export function LatestFormulasTable({ rows, editingId }: { rows: LatestFormula[]; editingId?: string }) {
  const [target, setTarget] = useState<DetailRef | null>(null);
  const close = useCallback(() => setTarget(null), []);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center">
        <Inbox className="h-8 w-8 text-gray-300" aria-hidden />
        <p className="text-sm text-gray-500">No formulas yet. Saved formulas appear here.</p>
      </div>
    );
  }

  const th = "whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600";
  const kg = (v: number) => `${formatQty(v)} kg`;
  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className={th}>Date</th>
              <th className={th}>S.No.</th>
              <th className={th}>Formula Name</th>
              <th className={th}>Formula Type</th>
              <th className={th}>Materials / Colors Used</th>
              <th className={th}>Mixing Time</th>
              <th className={`${th} text-right`}>Total Used</th>
              <th className={`${th} text-right`}>Required</th>
              <th className={`${th} text-right`}>Rate</th>
              <th className={th}>Review</th>
              <th className={`${th} text-right`}>Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((f) => (
              <tr key={f.id} className={`align-top ${f.id === editingId ? "bg-amber-50" : "hover:bg-gray-50"}`}>
                <td className="whitespace-nowrap px-3 py-2.5">{format(parseISO(f.date), "dd MMM yyyy")}</td>
                <td className="px-3 py-2.5 tabular-nums">{f.serialNo}</td>
                <td className="px-3 py-2.5 font-semibold text-brand-800">{f.name}</td>
                <td className="whitespace-nowrap px-3 py-2.5">{f.typeLabel}</td>
                <td className="px-3 py-2.5 text-gray-700">{f.ingredients}</td>
                <td className="whitespace-nowrap px-3 py-2.5">{f.mixing}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{kg(f.totalUsedKg)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums">{kg(f.requiredKg)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatQty(f.rate)}</td>
                <td className="px-2 py-1.5">
                  <ReviewButton onClick={() => setTarget({ type: "formula", id: f.id })} label={`formula ${f.name}`} />
                </td>
                <td className="px-2 py-1.5">
                  <EditDeleteButtons id={f.id} label={`Formula ${f.name} (S.No. ${f.serialNo})`} basePath="/formula-creation" remove={deleteFormula} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RecordDetailModal target={target} onClose={close} />
    </>
  );
}
