// Requirement Table arithmetic. Pure and shared: the form runs it live as the
// operator types, and the save action runs it again on the server so the
// stored figures never depend on what the browser sent.
//
// Precision rules
// - Quantities are entered to at most 3 decimals in their own unit.
// - Total Quantity Used is the exact kg sum (grams / 1000), kept to 6
//   decimals so small gram amounts are not lost; it is shown to 3.
// - Consumption Rate = Total Required / Total Used, rounded to 3 decimals.
// - Each material's required quantity = its quantity x the ROUNDED rate,
//   rounded to 3 decimals, in the material's own unit. Using the rate as
//   displayed means every figure on the sheet can be checked by hand
//   (81 gm x 4.437 = 359.397 gm).

export type Unit = "KG" | "GM";

export interface CalcItem {
  unit: Unit;
  quantity: number;
}

export interface Requirement {
  totalUsedKg: number;
  totalRequiredKg: number;
  /** null until both totals are positive. */
  consumptionRate: number | null;
  /** One per input item, same order, in that item's unit; null without a rate. */
  requiredQuantities: (number | null)[];
}

/** Round half away from zero at `dp` decimals. toPrecision(15) first strips
 *  the binary noise (1.0005 * 1000 = 1000.4999999999999) before rounding. */
export function round(value: number, dp: number): number {
  const f = 10 ** dp;
  const scaled = Number((Math.abs(value) * f).toPrecision(15));
  return (Math.sign(value) * Math.round(scaled)) / f;
}

export function toKg(quantity: number, unit: Unit): number {
  return unit === "GM" ? quantity / 1000 : quantity;
}

function finite(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

export function calculateRequirement(items: CalcItem[], totalRequiredKg: number): Requirement {
  // Sum in milligrams-as-integers would also work; summing kg then rounding
  // to 6 dp gives the same result for 3-dp inputs and reads more plainly.
  const totalUsedKg = round(
    items.reduce((sum, i) => sum + toKg(finite(i.quantity), i.unit), 0),
    6,
  );
  const required = finite(totalRequiredKg);
  const consumptionRate =
    totalUsedKg > 0 && required > 0 ? round(required / totalUsedKg, 3) : null;

  return {
    totalUsedKg,
    totalRequiredKg: required,
    consumptionRate,
    requiredQuantities: items.map((i) =>
      consumptionRate === null ? null : round(finite(i.quantity) * consumptionRate, 3),
    ),
  };
}

export function formatQty(value: number | null | undefined, dp = 3): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: dp });
}
