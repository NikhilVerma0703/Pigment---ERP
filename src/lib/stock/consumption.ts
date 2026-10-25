// Pigment/colour consumption rules. Pure: the queries feed saved records in,
// and every figure on Stocks and Consumption comes out of here, so the stock
// page always agrees with the records it is computed from.
//
// Rules
// - Everything is converted to kg (gm / 1000) and kept to 6 decimals.
// - Formula Creation: each row's Required Quantity (the scaled amount
//   actually made for the formula) is consumed on the formula's date.
// - Daily Production: a pigment's "Quantity Used" is per cycle.
//     no cycle change  → quantity × total cycles
//     cycle changed    → each range: quantity × (To − From + 1);
//                        cycles no range covers use the base pigment rows.
// - Materials (Grit, Resin, …) are recorded as entered — a total, not per
//   cycle — and have consumption only, never stock.

import { round, toKg, type Unit } from "@/lib/formula/calc";
import { nameKey } from "@/lib/utils";

export interface Usage {
  nameKey: string;
  name: string;
  /** yyyy-mm-dd */
  date: string;
  kg: number;
  source: "formula" | "production";
  /** The quantity and unit as recorded (per cycle for production). */
  quantity: number;
  unit: Unit;
  /** Production only: cycles the quantity was multiplied by. */
  cycles: number | null;
  /** Production only: the mixer, when the caller passed one. */
  mixer: string | null;
  /** Production only: the cycle range, or null for the base rows. */
  range: { from: number; to: number } | null;
}

export interface QtyRow {
  name: string;
  unit: Unit;
  quantity: number;
}

export interface FormulaForUsage {
  date: string;
  items: { name: string; unit: Unit; requiredQuantity: number }[];
}

export interface ProductionForUsage {
  date: string;
  totalCycles: number;
  mixers: {
    mixer?: string;
    cycleTimeChanged: boolean;
    pigments: QtyRow[];
    changes: { fromCycle: number; toCycle: number; pigments: QtyRow[] }[];
  }[];
}

const kg6 = (n: number) => round(n, 6);

export function formulaUsage(f: FormulaForUsage): Usage[] {
  return f.items.map((i) => ({
    nameKey: nameKey(i.name),
    name: i.name,
    date: f.date,
    kg: kg6(toKg(i.requiredQuantity, i.unit)),
    source: "formula" as const,
    quantity: i.requiredQuantity,
    unit: i.unit,
    cycles: null,
    mixer: null,
    range: null,
  }));
}

/** How many cycles each set of pigment rows ran for: the base rows, and each
 *  cycle range in order. The one place the per-cycle rule lives. */
export function cycleSpans(
  totalCycles: number,
  cycleTimeChanged: boolean,
  changes: { fromCycle: number; toCycle: number }[],
): { baseCycles: number; spans: number[] } {
  if (!cycleTimeChanged || changes.length === 0) return { baseCycles: totalCycles, spans: [] };
  const spans = changes.map((c) => Math.max(0, Math.min(c.toCycle, totalCycles) - c.fromCycle + 1));
  const covered = spans.reduce((a, b) => a + b, 0);
  return { baseCycles: Math.max(0, totalCycles - covered), spans };
}

export function productionPigmentUsage(p: ProductionForUsage): Usage[] {
  const out: Usage[] = [];
  const add = (rows: QtyRow[], cycles: number, mixer: string | undefined, range: Usage["range"]) => {
    if (cycles <= 0) return;
    for (const r of rows) {
      out.push({
        nameKey: nameKey(r.name),
        name: r.name,
        date: p.date,
        kg: kg6(toKg(r.quantity, r.unit) * cycles),
        source: "production",
        quantity: r.quantity,
        unit: r.unit,
        cycles,
        mixer: mixer ?? null,
        range,
      });
    }
  };

  for (const m of p.mixers) {
    const { baseCycles, spans } = cycleSpans(p.totalCycles, m.cycleTimeChanged, m.changes);
    m.changes.forEach((c, i) => add(c.pigments, spans[i], m.mixer, { from: c.fromCycle, to: c.toCycle }));
    add(m.pigments, baseCycles, m.mixer, null);
  }
  return out;
}

/** Sum kg per key; returns a Map key → kg (6 dp). */
export function sumBy<T>(rows: T[], key: (r: T) => string, kg: (r: T) => number): Map<string, number> {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(key(r), (totals.get(key(r)) ?? 0) + kg(r));
  for (const [k, v] of totals) totals.set(k, kg6(v));
  return totals;
}

/** A stable, readable swatch colour for a pigment that has none yet. */
export function defaultSwatch(name: string): string {
  let h = 0;
  for (const ch of nameKey(name)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  // HSL → hex at a mid saturation/lightness so the swatch reads on white.
  const s = 0.55;
  const l = 0.5;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
