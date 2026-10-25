import "server-only";
import { format, parseISO, startOfWeek } from "date-fns";
import { round } from "@/lib/formula/calc";
import { MIXERS } from "@/lib/production/constants";
import type { Group } from "@/lib/reports/period";
import { searchProduction } from "@/lib/search/queries";
import type { PigmentLine, ProductionDetail } from "@/lib/search/types";
import { nameKey } from "@/lib/utils";

// Reports read the same production details Searching shows (and so the same
// per-cycle consumption rules); here they are only grouped and summed.

const kg6 = (n: number) => round(n, 6);
const MIXER_LABELS = MIXERS.map((m) => m.label);

export interface MixerStats {
  label: string;
  records: number;
  cycles: number;
  changedRecords: number;
  changeEntries: number;
  pigmentKg: number;
  materialKg: number;
}

export interface PeriodRow {
  key: string;
  label: string;
  records: number;
  batches: number;
  cycles: number;
  /** Cycles run per mixer label. */
  mixerCycles: Record<string, number>;
  changedMixers: number;
  changeEntries: number;
  pigmentKg: number;
  materialKg: number;
}

export interface CycleChangeRow {
  id: string;
  recordId: string;
  date: string;
  serialNo: number;
  batchNumber: string;
  designName: string;
  mixer: string;
  seq: number;
  range: string;
  cycles: number;
  pigments: string;
  pigmentKg: number;
}

export interface ProductionSummary {
  periods: PeriodRow[];
  totals: PeriodRow;
  mixers: MixerStats[];
  changes: CycleChangeRow[];
}

function bucket(date: string, group: Group): { key: string; label: string } {
  const d = parseISO(date);
  if (group === "monthly") return { key: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") };
  if (group === "weekly") {
    const start = startOfWeek(d, { weekStartsOn: 1 });
    return { key: format(start, "yyyy-MM-dd"), label: `Week of ${format(start, "dd MMM yyyy")}` };
  }
  return { key: date, label: format(d, "dd MMM yyyy (EEE)") };
}

function emptyPeriod(key: string, label: string): PeriodRow & { batchSet: Set<string> } {
  return {
    key,
    label,
    records: 0,
    batches: 0,
    batchSet: new Set(),
    cycles: 0,
    mixerCycles: Object.fromEntries(MIXER_LABELS.map((l) => [l, 0])),
    changedMixers: 0,
    changeEntries: 0,
    pigmentKg: 0,
    materialKg: 0,
  };
}

function addRecord(p: ReturnType<typeof emptyPeriod>, r: ProductionDetail) {
  p.records++;
  p.batchSet.add(nameKey(r.batchNumber));
  p.cycles += r.totalCycles;
  for (const m of r.mixers) {
    p.mixerCycles[m.label] = (p.mixerCycles[m.label] ?? 0) + r.totalCycles;
    if (m.cycleTimeChanged && m.changes.length) {
      p.changedMixers++;
      p.changeEntries += m.changes.length;
    }
  }
  p.pigmentKg = kg6(p.pigmentKg + r.pigmentKg);
  p.materialKg = kg6(p.materialKg + r.materialKg);
}

const lineKg = (lines: PigmentLine[]) => lines.reduce((s, l) => s + l.consumedKg, 0);

export async function getProductionSummary(from: string, to: string, group: Group): Promise<ProductionSummary> {
  const records = await searchProduction({ from, to });

  const periods = new Map<string, ReturnType<typeof emptyPeriod>>();
  const totals = emptyPeriod("total", "Total");
  const mixers = new Map<string, MixerStats>(
    MIXER_LABELS.map((label) => [label, { label, records: 0, cycles: 0, changedRecords: 0, changeEntries: 0, pigmentKg: 0, materialKg: 0 }]),
  );
  const changes: CycleChangeRow[] = [];

  for (const r of records) {
    const b = bucket(r.date, group);
    const p = periods.get(b.key) ?? emptyPeriod(b.key, b.label);
    periods.set(b.key, p);
    addRecord(p, r);
    addRecord(totals, r);

    for (const m of r.mixers) {
      const s = mixers.get(m.label)!;
      s.records++;
      s.cycles += r.totalCycles;
      s.pigmentKg = kg6(s.pigmentKg + lineKg(m.pigments) + m.changes.reduce((t, c) => t + lineKg(c.pigments), 0));
      s.materialKg = kg6(s.materialKg + m.materials.reduce((t, x) => t + x.kg, 0));
      if (m.cycleTimeChanged && m.changes.length) {
        s.changedRecords++;
        s.changeEntries += m.changes.length;
      }
      for (const c of m.changes) {
        changes.push({
          id: `${r.id}-${m.label}-${c.seq}`,
          recordId: r.id,
          date: r.date,
          serialNo: r.serialNo,
          batchNumber: r.batchNumber,
          designName: r.designName,
          mixer: m.label,
          seq: c.seq,
          range: `${c.fromCycle}–${c.toCycle}`,
          cycles: c.toCycle - c.fromCycle + 1,
          pigments: c.pigments.map((l) => `${l.name} ${l.quantity} ${l.unit === "GM" ? "gm" : "kg"}`).join(", "),
          pigmentKg: kg6(lineKg(c.pigments)),
        });
      }
    }
  }

  const finish = ({ batchSet, ...p }: ReturnType<typeof emptyPeriod>): PeriodRow => ({ ...p, batches: batchSet.size });
  return {
    periods: [...periods.values()].sort((a, b) => b.key.localeCompare(a.key)).map(finish),
    totals: finish(totals),
    mixers: [...mixers.values()],
    changes,
  };
}

// ---------------------------------------------------------------------------

export interface ConsumptionRow {
  id: string;
  date: string;
  serialNo: number;
  batchNumber: string;
  locNumber: string;
  designName: string;
  pigmentKg: number;
  materialKg: number;
  pigments: { name: string; kg: number }[];
  materials: { name: string; kg: number }[];
}

export interface ConsumptionReport {
  rows: ConsumptionRow[];
  pigmentTotals: { name: string; kg: number; records: number }[];
  materialTotals: { name: string; kg: number; records: number }[];
  pigmentKg: number;
  materialKg: number;
}

function addTo(map: Map<string, { name: string; kg: number; records: Set<string> }>, name: string, kg: number, recordId: string) {
  const key = nameKey(name);
  const e = map.get(key) ?? { name, kg: 0, records: new Set<string>() };
  e.kg = kg6(e.kg + kg);
  e.records.add(recordId);
  map.set(key, e);
}

const sorted = (map: Map<string, { name: string; kg: number; records: Set<string> }>) =>
  [...map.values()].map((e) => ({ name: e.name, kg: e.kg, records: e.records.size })).sort((a, b) => b.kg - a.kg);

/** Production-wise pigment and material consumption, plus period totals. */
export async function getConsumptionReport(from: string, to: string): Promise<ConsumptionReport> {
  const records = await searchProduction({ from, to });
  const pigmentAll = new Map<string, { name: string; kg: number; records: Set<string> }>();
  const materialAll = new Map<string, { name: string; kg: number; records: Set<string> }>();

  const rows: ConsumptionRow[] = records.map((r) => {
    const pig = new Map<string, { name: string; kg: number; records: Set<string> }>();
    const mat = new Map<string, { name: string; kg: number; records: Set<string> }>();
    for (const m of r.mixers) {
      for (const l of [...m.pigments, ...m.changes.flatMap((c) => c.pigments)]) {
        if (l.consumedKg <= 0) continue;
        addTo(pig, l.name, l.consumedKg, r.id);
        addTo(pigmentAll, l.name, l.consumedKg, r.id);
      }
      for (const x of m.materials) {
        addTo(mat, x.name, x.kg, r.id);
        addTo(materialAll, x.name, x.kg, r.id);
      }
    }
    return {
      id: r.id,
      date: r.date,
      serialNo: r.serialNo,
      batchNumber: r.batchNumber,
      locNumber: r.locNumber,
      designName: r.designName,
      pigmentKg: r.pigmentKg,
      materialKg: r.materialKg,
      pigments: sorted(pig).map(({ name, kg }) => ({ name, kg })),
      materials: sorted(mat).map(({ name, kg }) => ({ name, kg })),
    };
  });

  return {
    rows,
    pigmentTotals: sorted(pigmentAll),
    materialTotals: sorted(materialAll),
    pigmentKg: kg6(rows.reduce((s, r) => s + r.pigmentKg, 0)),
    materialKg: kg6(rows.reduce((s, r) => s + r.materialKg, 0)),
  };
}
