import type { ReactNode } from "react";
import { formatQty, type Requirement, type Unit } from "@/lib/formula/calc";

const unitLabel = (u: Unit) => (u === "GM" ? "gm" : "kg");

/** The "Requirement Table": totals, consumption rate and every material's
 *  scaled quantity. Display only — the numbers come from calculateRequirement. */
export function RequirementTable({
  requirement,
  items,
  totalRequiredInput,
}: {
  requirement: Requirement;
  items: { name: string; unit: Unit; quantity: number }[];
  totalRequiredInput: ReactNode;
}) {
  const { totalUsedKg, totalRequiredKg, consumptionRate, requiredQuantities } = requirement;
  const rowHead = "w-1/3 min-w-[200px] bg-gray-50 px-4 py-3 text-left align-top text-sm font-semibold text-gray-700";

  return (
    <section className="card p-5">
      <h2 className="mb-4 text-base font-semibold text-pacific-dark">Requirement Table</h2>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[640px] text-sm">
          <tbody className="divide-y divide-gray-200">
            <tr>
              <th scope="row" className={rowHead}>Total Quantity Used (in kg)</th>
              <td className="px-4 py-3">
                <span className="text-lg font-semibold tabular-nums text-gray-900">{formatQty(totalUsedKg)}</span>{" "}
                <span className="text-gray-600">kg</span>
              </td>
            </tr>
            <tr>
              <th scope="row" className={rowHead}>Total Quantity Required</th>
              <td className="px-4 py-3">{totalRequiredInput}</td>
            </tr>
            <tr>
              <th scope="row" className={rowHead}>Consumption Rate</th>
              <td className="px-4 py-3">
                {consumptionRate === null ? (
                  <span className="text-gray-400">Enter quantities and Total Quantity Required</span>
                ) : (
                  <>
                    <span className="text-lg font-semibold tabular-nums text-brand-700">{formatQty(consumptionRate)}</span>
                    <p className="mt-0.5 text-xs tabular-nums text-gray-500">
                      {formatQty(totalRequiredKg)} ÷ {formatQty(totalUsedKg)} = {formatQty(consumptionRate)}
                    </p>
                  </>
                )}
              </td>
            </tr>
            <tr>
              <th scope="row" className={rowHead}>Required Quantity for Each Material/Color</th>
              <td className="px-4 py-3">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="w-12 pb-2">S.No.</th>
                      <th className="pb-2">Material/Color</th>
                      <th className="pb-2 text-right">Calculation</th>
                      <th className="pb-2 text-right">Required Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((item, i) => {
                      const req = requiredQuantities[i];
                      return (
                        <tr key={i}>
                          <td className="py-2 text-gray-600">{i + 1}</td>
                          <td className="py-2 font-medium text-gray-800">
                            {item.name.trim() || <span className="font-normal text-gray-400">—</span>}
                          </td>
                          <td className="py-2 text-right tabular-nums text-gray-500">
                            {req === null || req === undefined
                              ? "—"
                              : `${formatQty(item.quantity)} ${unitLabel(item.unit)} × ${formatQty(consumptionRate)}`}
                          </td>
                          <td className="py-2 text-right font-semibold tabular-nums text-gray-900">
                            {req === null || req === undefined ? "—" : `${formatQty(req)} ${unitLabel(item.unit)}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
