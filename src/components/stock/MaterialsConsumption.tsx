import { format, parseISO } from "date-fns";
import { formatQty } from "@/lib/formula/calc";
import type { StockPageData } from "@/lib/stock/queries";

/** Materials (Grit, Powder, Resin, …): consumption only, per day and in total. */
export function MaterialsConsumption({ data }: { data: StockPageData["materials"] }) {
  if (data.rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
        No material consumption yet. It appears here once a Daily Production record is saved.
      </p>
    );
  }
  const num = "px-3 py-2.5 text-right tabular-nums";
  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600">
            <tr>
              <th className="sticky left-0 z-10 w-14 bg-gray-50 px-3 py-2 text-left">S.No.</th>
              <th className="sticky left-14 z-10 min-w-[140px] bg-gray-50 px-3 py-2 text-left">Material</th>
              {data.dates.map((d) => (
                <th key={d} className="whitespace-nowrap px-3 py-2 text-right">{format(parseISO(d), "dd MMM")}</th>
              ))}
              <th className="whitespace-nowrap bg-brand-50 px-3 py-2 text-right text-brand-800">Total Consumed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.rows.map((r, i) => (
              <tr key={r.name}>
                <td className="sticky left-0 bg-white px-3 py-2.5 text-gray-600">{i + 1}</td>
                <td className="sticky left-14 bg-white px-3 py-2.5 font-medium text-gray-900">{r.name}</td>
                {data.dates.map((d) => (
                  <td key={d} className={num}>
                    {r.byDate[d] ? formatQty(r.byDate[d]) : <span className="text-gray-300">—</span>}
                  </td>
                ))}
                <td className={`${num} bg-brand-50/50 font-semibold text-gray-900`}>{formatQty(r.totalKg)} kg</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
