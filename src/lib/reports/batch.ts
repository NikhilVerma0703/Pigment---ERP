// Batch Details Report: one production record laid out as
//   - basic information (one row),
//   - Materials Consumption, a vertical table: a row per material (Grit and
//     Powder: a row per size), a column per mixer, and a total,
//   - Pigment Details, a horizontal table: a row per mixer, the original
//     pigments, then one column per cycle range when the cycle time changed.
// Pure: the screen, the Excel export and the PDF all render this same shape.

import { formatQty, round } from "@/lib/formula/calc";
import { MATERIAL_SPECS, type MaterialCategory } from "@/lib/production/materials";
import type { PigmentLine, ProductionDetail } from "@/lib/search/types";

export interface BatchMaterialRow {
  key: string;
  /** Shown on the first row of each material only. */
  sno: number | null;
  material: string;
  size: string;
  /** kg per mixer, in the order of `mixers`; null when that mixer used none. */
  perMixer: (number | null)[];
  totalKg: number | null;
}

export interface BatchPigmentRow {
  mixer: string;
  original: string;
  /** One cell per entry in `rangeColumns`. */
  ranges: string[];
}

export interface BatchReport {
  id: string;
  serialNo: number;
  batchNumber: string;
  date: string;
  locNumber: string;
  designName: string;
  totalCycles: number;
  mixers: string[];
  materialRows: BatchMaterialRow[];
  /** e.g. "1–8", "9–16"; empty when no mixer changed its cycle time. */
  rangeColumns: string[];
  pigmentRows: BatchPigmentRow[];
}

const kg6 = (n: number) => round(n, 6);
const EMPTY = "—";

/** "SW: 2.5 kg + Yellow: 300 gm" — quantities as entered (per cycle). */
export function pigmentText(lines: PigmentLine[]): string {
  if (lines.length === 0) return EMPTY;
  return lines.map((l) => `${l.name}: ${formatQty(l.quantity)} ${l.unit === "GM" ? "gm" : "kg"}`).join(" + ");
}

export function buildBatchReport(d: ProductionDetail): BatchReport {
  const mixers = d.mixers.map((m) => m.label);

  // ---- Materials --------------------------------------------------------------
  type Group = { material: string; size: string; perMixer: number[]; used: boolean[] };
  const groups = new Map<string, Group>();
  const order: { key: string; category: MaterialCategory | "OTHER"; material: string; size: string }[] = [];
  const keyOf = (category: string, material: string, size: string) => `${category}|${material.toLowerCase()}|${size}`;

  d.mixers.forEach((m, mi) => {
    for (const x of m.materials) {
      const bySize = x.category === "GRIT" || x.category === "POWDER";
      const size = bySize ? x.size || EMPTY : EMPTY;
      const key = keyOf(x.category, x.name, size);
      let g = groups.get(key);
      if (!g) {
        g = { material: x.name, size, perMixer: mixers.map(() => 0), used: mixers.map(() => false) };
        groups.set(key, g);
        order.push({ key, category: x.category, material: x.name, size });
      }
      g.perMixer[mi] = kg6(g.perMixer[mi] + x.kg);
      g.used[mi] = true;
    }
  });

  const materialRows: BatchMaterialRow[] = [];
  let sno = 0;
  const emit = (keys: string[], material: string) => {
    sno++;
    if (keys.length === 0) {
      materialRows.push({ key: `none-${material}`, sno, material, size: EMPTY, perMixer: mixers.map(() => null), totalKg: null });
      return;
    }
    keys.forEach((key, i) => {
      const g = groups.get(key)!;
      const perMixer = g.perMixer.map((v, mi) => (g.used[mi] ? v : null));
      materialRows.push({
        key,
        sno: i === 0 ? sno : null,
        material: i === 0 ? material : "",
        size: g.size,
        perMixer,
        totalKg: kg6(g.perMixer.reduce((a, b) => a + b, 0)),
      });
    });
  };

  // The six standard materials always appear, in order; Grit / Powder sizes in
  // preset order, then any other sizes A–Z.
  for (const spec of MATERIAL_SPECS) {
    const rank = (size: string) => {
      const i = spec.sizes?.indexOf(size) ?? -1;
      return i === -1 ? 999 : i;
    };
    const keys = order
      .filter((o) => o.category === spec.category)
      .sort((a, b) => rank(a.size) - rank(b.size) || a.size.localeCompare(b.size))
      .map((o) => o.key);
    emit(keys, spec.label);
  }
  // Then "+ Others" materials, one row each.
  const others = new Map<string, string[]>();
  for (const o of order.filter((o) => o.category === "OTHER")) others.set(o.material, [...(others.get(o.material) ?? []), o.key]);
  for (const [material, keys] of others) emit(keys, material);

  // ---- Pigments -------------------------------------------------------------
  const ranges = new Map<string, { from: number; to: number }>();
  for (const m of d.mixers) for (const c of m.changes) ranges.set(`${c.fromCycle}–${c.toCycle}`, { from: c.fromCycle, to: c.toCycle });
  const rangeColumns = [...ranges.entries()].sort((a, b) => a[1].from - b[1].from || a[1].to - b[1].to).map(([k]) => k);

  const pigmentRows: BatchPigmentRow[] = d.mixers.map((m) => ({
    mixer: m.label,
    original: pigmentText(m.pigments),
    ranges: rangeColumns.map((col) => {
      const c = m.changes.find((x) => `${x.fromCycle}–${x.toCycle}` === col);
      return c ? pigmentText(c.pigments) : EMPTY;
    }),
  }));

  return {
    id: d.id,
    serialNo: d.serialNo,
    batchNumber: d.batchNumber,
    date: d.date,
    locNumber: d.locNumber,
    designName: d.designName,
    totalCycles: d.totalCycles,
    mixers,
    materialRows,
    rangeColumns,
    pigmentRows,
  };
}

export const kgText = (v: number | null) => (v === null ? EMPTY : `${formatQty(v)} kg`);
