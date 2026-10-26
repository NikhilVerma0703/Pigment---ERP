"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Inbox } from "lucide-react";
import { deleteProduction } from "@/app/pigment-packing/actions";
import { RecordDetailModal } from "@/components/search/RecordDetail";
import { EditDeleteButtons, ReviewButton } from "@/components/ui/RowActions";
import type { RecentProduction } from "@/lib/production/queries";
import type { DetailRef } from "@/lib/search/types";

/** The latest Daily Production records, with Review (read-only overview of
 *  every field: mixers, pigments, cycle changes, materials), Edit and Delete.
 *  The Batch Number opens that batch's Batch Details Report on the Dashboard. */
export function RecentProductionTable({ rows, editingId }: { rows: RecentProduction[]; editingId?: string }) {
  const [target, setTarget] = useState<DetailRef | null>(null);
  const close = useCallback(() => setTarget(null), []);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center">
        <Inbox className="h-8 w-8 text-gray-300" aria-hidden />
        <p className="text-sm text-gray-500">No production records yet. Saved records appear here.</p>
      </div>
    );
  }

  const th = "whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600";
  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className={th}>Date</th>
              <th className={th}>S.No.</th>
              <th className={th}>Batch Number</th>
              <th className={th}>LOC Number</th>
              <th className={th}>Production / Design Name</th>
              <th className={`${th} text-right`}>Total Cycles</th>
              <th className={`${th} text-right`}>Mixers Used</th>
              <th className={th}>Review</th>
              <th className={`${th} text-right`}>Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className={r.id === editingId ? "bg-amber-50" : "hover:bg-gray-50"}>
                <td className="whitespace-nowrap px-3 py-2.5">{format(parseISO(r.date), "dd MMM yyyy")}</td>
                <td className="px-3 py-2.5 tabular-nums">{r.serialNo}</td>
                <td className="px-3 py-2.5">
                  <Link
                    href={`/dashboard?batch=${r.id}`}
                    className="font-semibold text-brand-800 underline decoration-brand-300 underline-offset-2 hover:decoration-brand-700"
                    title="Open this batch's Batch Details Report"
                  >
                    {r.batchNumber}
                  </Link>
                </td>
                <td className="px-3 py-2.5">{r.locNumber}</td>
                <td className="px-3 py-2.5">{r.designName}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{r.totalCycles}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{r.mixersUsed}{r.roymixUsed && <span className="text-gray-500"> + Roymix</span>}</td>
                <td className="px-2 py-1.5">
                  <ReviewButton onClick={() => setTarget({ type: "production", id: r.id })} label={`batch ${r.batchNumber}`} />
                </td>
                <td className="px-2 py-1.5">
                  <EditDeleteButtons
                    id={r.id}
                    label={`Production record ${r.batchNumber} (S.No. ${r.serialNo})`}
                    basePath="/pigment-packing"
                    remove={deleteProduction}
                  />
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
