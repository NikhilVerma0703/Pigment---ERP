// Materials Consumption: the materials, their fields, and the percentage rule.
// Pure and shared by the form (live totals), the save action (stored values)
// and the batch report, so all three agree.
//
// Catalyst, Cobalt and Silane are entered as a percentage of resin:
//   quantity (kg) = percent / 100 × the mixer's total resin (kg)
// e.g. 2 % of 10 kg resin = 0.2 kg, shown in the entry's own unit.

import { round, toKg, type Unit } from "@/lib/formula/calc";

export type MaterialCategory = "GRIT" | "POWDER" | "RESIN" | "CATALYST" | "COBALT" | "SILANE" | "OTHER";

export interface MaterialSpec {
  category: MaterialCategory;
  label: string;
  /** Preset sizes; "+ Others" lets the user type any other size. */
  sizes?: readonly string[];
  /** Whether the entry has a name (Grit Name, Resin Name, …), a colour, a percentage. */
  name: boolean;
  color: boolean;
  percent: boolean;
}

export const GRIT_SIZES = ["0.1–0.2", "0.1–0.4", "0.3–0.7", "0.6–1.2–2.5", "2.5–4.0", "4.0–6.0", "6–8", "8–16", "16–30"] as const;
export const POWDER_SIZES = ["400#", "325#"] as const;

/** The six standard materials, in display order. */
export const MATERIAL_SPECS: readonly MaterialSpec[] = [
  { category: "GRIT", label: "Grit", sizes: GRIT_SIZES, name: true, color: true, percent: false },
  { category: "POWDER", label: "Powder", sizes: POWDER_SIZES, name: true, color: true, percent: false },
  { category: "RESIN", label: "Resin", name: true, color: false, percent: false },
  { category: "CATALYST", label: "Catalyst", name: true, color: false, percent: true },
  { category: "COBALT", label: "Cobalt", name: true, color: false, percent: true },
  { category: "SILANE", label: "Silane", name: true, color: false, percent: true },
];

export const OTHER_SPEC: MaterialSpec = { category: "OTHER", label: "Others", name: true, color: false, percent: false };

export function materialSpec(category: MaterialCategory): MaterialSpec {
  return MATERIAL_SPECS.find((s) => s.category === category) ?? OTHER_SPEC;
}

export const isPercentCategory = (c: MaterialCategory) => c === "CATALYST" || c === "COBALT" || c === "SILANE";

const QTY_RE = /^\d+(\.\d{1,3})?$/;

interface EntryLike {
  category: MaterialCategory;
  unit: Unit;
  quantity: string;
  percent: string;
}

/** Total resin in kg from a mixer's entries (valid quantities only). */
export function resinKg(entries: EntryLike[]): number {
  return round(
    entries
      .filter((e) => e.category === "RESIN" && QTY_RE.test(e.quantity.trim()))
      .reduce((sum, e) => sum + toKg(Number(e.quantity), e.unit), 0),
    6,
  );
}

/** The calculated quantity for a percentage entry, in its own unit (3 dp),
 *  or null when the percentage is not a valid number. */
export function percentQuantity(percent: string, unit: Unit, resin: number): number | null {
  const p = percent.trim();
  if (!QTY_RE.test(p)) return null;
  const kg = (Number(p) / 100) * resin;
  return round(unit === "GM" ? kg * 1000 : kg, 3);
}

/** An entry's quantity in kg: entered, or calculated for percentage entries. */
export function entryKg(entry: EntryLike, resin: number): number {
  if (isPercentCategory(entry.category)) {
    const q = percentQuantity(entry.percent, entry.unit, resin);
    return q === null ? 0 : toKg(q, entry.unit);
  }
  return QTY_RE.test(entry.quantity.trim()) ? toKg(Number(entry.quantity), entry.unit) : 0;
}

/** A one-line description of an entry: size · name · colour · percentage. */
export function materialDetail(e: { size?: string | null; itemName?: string | null; color?: string | null; percent?: number | null }): string {
  return [e.size, e.itemName, e.color, e.percent !== null && e.percent !== undefined ? `${e.percent}%` : ""]
    .filter((v) => v && String(v).trim())
    .join(" · ");
}
