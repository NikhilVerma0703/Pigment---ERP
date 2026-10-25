"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ChevronRight, Inbox } from "lucide-react";
import { RecordDetailModal } from "@/components/search/RecordDetail";
import type { RecentProduction } from "@/lib/dashboard/queries";
import type { DetailRef } from "@/lib/search/types";

/** The latest Daily Production records; a row opens the complete record. */
export function RecentProductionTable({ rows }: { rows: RecentProduction[] }) {
  const [target, setTarget] = useState<DetailRef | null>(null);
  const close = useCallback(() => setTarget(null), []);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center">
        <Inbox className="h-8 w-8 text-gray-300" aria-hidden />
        <p className="text-sm text-gray-500">No production records yet.</p>
        <Link href="/pigment-packing" className="text-sm font-semibold text-brand-700 hover:underline">
          Add a Daily Production record
        </Link>
      </div>
    );
  }

  const th = "whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600";
  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className={th}>Date</th>
              <th className={th}>S.No.</th>
              <th className={th}>Batch Number</th>
              <th className={th}>LOC Number</th>
              <th className={th}>Production / Design Name</th>
              <th className={`${th} text-right`}>Total Cycles</th>
              <th className={`${th} text-right`}>Mixers Used</th>
              <th className="w-8" aria-hidden />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr
                key={r.id}
                tabIndex={0}
                onClick={() => setTarget({ type: "production", id: r.id })}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setTarget({ type: "production", id: r.id }))}
                className="group cursor-pointer outline-none hover:bg-brand-50/60 focus-visible:bg-brand-50"
              >
                <td className="whitespace-nowrap px-3 py-2.5">{format(parseISO(r.date), "dd MMM yyyy")}</td>
                <td className="px-3 py-2.5 tabular-nums">{r.serialNo}</td>
                <td className="px-3 py-2.5 font-semibold text-brand-800">{r.batchNumber}</td>
                <td className="px-3 py-2.5">{r.locNumber}</td>
                <td className="px-3 py-2.5">{r.designName}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{r.totalCycles}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{r.mixersUsed}</td>
                <td className="px-2 text-gray-300 group-hover:text-brand-600">
                  <ChevronRight className="h-4 w-4" aria-hidden />
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
