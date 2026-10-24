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
  }));
}

export function productionPigmentUsage(p: ProductionForUsage): Usage[] {
  const out: Usage[] = [];
  const add = (rows: QtyRow[], cycles: number) => {
    if (cycles <= 0) return;
    for (const r of rows) {
      out.push({
        nameKey: nameKey(r.name),
        name: r.name,
        date: p.date,
        kg: kg6(toKg(r.quantity, r.unit) * cycles),
        source: "production",
      });
    }
  };

  for (const m of p.mixers) {
    if (!m.cycleTimeChanged || m.changes.length === 0) {
      add(m.pigments, p.totalCycles);
      continue;
    }
    let covered = 0;
    for (const c of m.changes) {
      const span = Math.max(0, Math.min(c.toCycle, p.totalCycles) - c.fromCycle + 1);
      covered += span;
      add(c.pigments, span);
    }
    add(m.pigments, Math.max(0, p.totalCycles - covered));
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
