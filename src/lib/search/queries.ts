import "server-only";
import type { FormulaType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { round, toKg } from "@/lib/formula/calc";
import { formulaTypeLabel } from "@/lib/formula/constants";
import { mixerLabel, mixerOrder, parseMixerFilter } from "@/lib/production/constants";
import { cycleSpans, formulaAddition, productionPigmentUsage } from "@/lib/stock/consumption";

const ENTRY_LABEL = { INITIAL: "Initial stock", ADDITION: "Stock added", ADJUSTMENT: "Stock adjusted" } as const;
import { materialDetail } from "@/lib/production/materials";
import type { Filters } from "@/lib/search/filters";
import type {
  FormulaDetail,
  MaterialDaily,
  MaterialRow,
  PigmentLine,
  PigmentSummary,
  PigmentTxn,
  ProductionDetail,
  SearchSuggestions,
} from "@/lib/search/types";
import { nameKey } from "@/lib/utils";

// Every search reads the saved records directly; consumption figures come
// from lib/stock/consumption, the same rules the Stocks page uses.

const num = (d: { toString(): string }) => Number(d.toString());
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const kg6 = (n: number) => round(n, 6);
const like = (v: string) => ({ contains: v, mode: "insensitive" as const });
const includes = (hay: string, needle: string) => hay.toLowerCase().includes(needle.toLowerCase());

function dateRange(f: Filters): Prisma.DateTimeFilter | undefined {
  if (!f.from && !f.to) return undefined;
  return {
    ...(f.from ? { gte: new Date(`${f.from}T00:00:00.000Z`) } : {}),
    ...(f.to ? { lte: new Date(`${f.to}T00:00:00.000Z`) } : {}),
  };
}
const inDates = (date: string, f: Filters) => (!f.from || date >= f.from) && (!f.to || date <= f.to);

// ---------------------------------------------------------------------------
// Formulas
// ---------------------------------------------------------------------------

const formulaSelect = {
  id: true,
  serialNo: true,
  date: true,
  name: true,
  formulaType: true,
  mixingHours: true,
  mixingMinutes: true,
  totalQuantityUsedKg: true,
  totalQuantityRequiredKg: true,
  consumptionRate: true,
  items: {
    orderBy: { lineNo: "asc" as const },
    select: { lineNo: true, name: true, unit: true, quantity: true, requiredQuantity: true, componentFormulaId: true },
  },
} satisfies Prisma.FormulaSelect;

function toFormulaDetail(f: Prisma.FormulaGetPayload<{ select: typeof formulaSelect }>): FormulaDetail {
  return {
    id: f.id,
    serialNo: f.serialNo,
    date: ymd(f.date),
    name: f.name,
    typeLabel: formulaTypeLabel(f.formulaType),
    mixingHours: f.mixingHours,
    mixingMinutes: f.mixingMinutes,
    totalUsedKg: num(f.totalQuantityUsedKg),
    requiredKg: num(f.totalQuantityRequiredKg),
    rate: num(f.consumptionRate),
    items: f.items.map((i) => ({
      lineNo: i.lineNo,
      name: i.name,
      unit: i.unit,
      quantity: num(i.quantity),
      requiredQuantity: num(i.requiredQuantity),
      isFormula: i.componentFormulaId !== null,
    })),
  };
}

const FORMULA_TYPES: FormulaType[] = ["LIQUID_VEIN", "DRY_VEIN_PIGMENT", "OTHERS"];

export async function searchFormulas(f: Filters): Promise<FormulaDetail[]> {
  const rows = await prisma.formula.findMany({
    where: {
      ...(f.name ? { name: like(f.name) } : {}),
      ...(f.type && FORMULA_TYPES.includes(f.type as FormulaType) ? { formulaType: f.type as FormulaType } : {}),
      ...(f.material ? { items: { some: { name: like(f.material) } } } : {}),
      ...(dateRange(f) ? { date: dateRange(f) } : {}),
    },
    select: formulaSelect,
    orderBy: [{ date: "desc" }, { serialNo: "desc" }],
  });
  return rows.map(toFormulaDetail);
}

export async function getFormulaDetail(id: string): Promise<FormulaDetail | null> {
  const f = await prisma.formula.findUnique({ where: { id }, select: formulaSelect });
  return f ? toFormulaDetail(f) : null;
}

// ---------------------------------------------------------------------------
// Daily Production
// ---------------------------------------------------------------------------

const qtyRow = { select: { lineNo: true, name: true, unit: true, quantity: true, formulaId: true } } as const;

const productionSelect = {
  id: true,
  createdAt: true,
  serialNo: true,
  date: true,
  batchNumber: true,
  locNumber: true,
  designName: true,
  totalCycles: true,
  mixersUsed: true,
  roymixUsed: true,
  mixers: {
    select: {
      kind: true,
      position: true,
      cycleTimeChanged: true,
      pigments: { where: { cycleChangeId: null }, orderBy: { lineNo: "asc" as const }, ...qtyRow },
      cycleChanges: {
        orderBy: { seq: "asc" as const },
        select: { seq: true, fromCycle: true, toCycle: true, pigments: { orderBy: { lineNo: "asc" as const }, ...qtyRow } },
      },
      materials: {
        orderBy: { lineNo: "asc" as const },
        select: { lineNo: true, category: true, name: true, size: true, itemName: true, color: true, percent: true, unit: true, quantity: true, isStandard: true },
      },
    },
  },
} satisfies Prisma.ProductionRecordSelect;

type ProductionPayload = Prisma.ProductionRecordGetPayload<{ select: typeof productionSelect }>;

function toProductionDetail(r: ProductionPayload): ProductionDetail {
  let pigmentKg = 0;
  let materialKg = 0;
  const lines = (rows: ProductionPayload["mixers"][number]["pigments"], cycles: number): PigmentLine[] =>
    rows.map((p) => {
      const consumedKg = kg6(toKg(num(p.quantity), p.unit) * cycles);
      pigmentKg += consumedKg;
      return {
        lineNo: p.lineNo,
        name: p.name,
        unit: p.unit,
        quantity: num(p.quantity),
        isFormula: p.formulaId !== null,
        cycles,
        consumedKg,
      };
    });

  const mixers = [...r.mixers]
    .sort((a, b) => mixerOrder(a.kind, a.position) - mixerOrder(b.kind, b.position))
    .map((m) => {
      const { baseCycles, spans } = cycleSpans(r.totalCycles, m.cycleTimeChanged, m.cycleChanges);
      return {
        label: mixerLabel(m.kind, m.position),
        order: mixerOrder(m.kind, m.position),
        cycleTimeChanged: m.cycleTimeChanged,
        baseCycles,
        pigments: lines(m.pigments, baseCycles),
        changes: m.cycleChanges.map((c, i) => ({
          seq: c.seq,
          fromCycle: c.fromCycle,
          toCycle: c.toCycle,
          pigments: lines(c.pigments, spans[i] ?? 0),
        })),
        materials: m.materials.map((x) => {
          const kg = kg6(toKg(num(x.quantity), x.unit));
          materialKg += kg;
          return {
            lineNo: x.lineNo,
            category: x.category,
            name: x.name,
            size: x.size ?? "",
            itemName: x.itemName ?? "",
            color: x.color ?? "",
            percent: x.percent === null ? null : num(x.percent),
            unit: x.unit,
            quantity: num(x.quantity),
            kg,
            isStandard: x.isStandard,
          };
        }),
      };
    });

  return {
    id: r.id,
    serialNo: r.serialNo,
    date: ymd(r.date),
    batchNumber: r.batchNumber,
    locNumber: r.locNumber,
    designName: r.designName,
    totalCycles: r.totalCycles,
    mixersUsed: r.mixersUsed,
    roymixUsed: r.roymixUsed,
    pigmentKg: kg6(pigmentKg),
    materialKg: kg6(materialKg),
    mixers,
  };
}

export async function searchProduction(f: Filters): Promise<ProductionDetail[]> {
  const rows = await prisma.productionRecord.findMany({
    where: {
      ...(f.batch ? { batchNumber: like(f.batch) } : {}),
      ...(f.loc ? { locNumber: like(f.loc) } : {}),
      ...(f.design ? { designName: like(f.design) } : {}),
      ...(f.pigment ? { mixers: { some: { pigments: { some: { name: like(f.pigment) } } } } } : {}),
      ...(dateRange(f) ? { date: dateRange(f) } : {}),
    },
    select: productionSelect,
    orderBy: [{ date: "desc" }, { serialNo: "desc" }],
  });
  return rows.map(toProductionDetail);
}

export async function getProductionDetail(id: string): Promise<ProductionDetail | null> {
  const r = await prisma.productionRecord.findUnique({ where: { id }, select: productionSelect });
  return r ? toProductionDetail(r) : null;
}

// ---------------------------------------------------------------------------
// Stock & pigment consumption — transaction history with running balance
// ---------------------------------------------------------------------------

/**
 * Every stock movement of every pigment: initial stock, manual additions and
 * adjustments, formula production (+) and Daily Production consumption (−).
 * The running balance is computed over the pigment's whole history first and
 * the filters are applied after, so a filtered row still shows the true
 * balance at that moment. A production pigment not on the stock list shows no
 * balance. A formula's ingredients are not deducted (the stock rules).
 */
export async function searchPigments(f: Filters): Promise<{ rows: PigmentTxn[]; summary: PigmentSummary[] }> {
  const [stocks, formulas, records] = await Promise.all([
    prisma.pigmentStock.findMany({
      select: {
        name: true,
        nameKey: true,
        color: true,
        entries: { select: { id: true, kind: true, note: true, date: true, unit: true, quantity: true, quantityKg: true, createdAt: true } },
      },
    }),
    prisma.formula.findMany({
      select: {
        id: true,
        serialNo: true,
        name: true,
        nameKey: true,
        date: true,
        createdAt: true,
        totalQuantityRequiredKg: true,
      },
    }),
    prisma.productionRecord.findMany({ select: productionSelect }),
  ]);

  const stockByKey = new Map(stocks.map((s) => [s.nameKey, s]));
  // `at` (when it was saved) orders transactions on the same date.
  type Raw = Omit<PigmentTxn, "balanceKg" | "color"> & { key: string; order: number; at: string };
  const raw: Raw[] = [];
  const blank = { batchNumber: "", locNumber: "", designName: "", mixer: "", range: "", cycles: null };

  for (const s of stocks) {
    for (const e of s.entries) {
      raw.push({
        ...blank,
        id: `in-${e.id}`,
        key: s.nameKey,
        order: 0,
        at: e.createdAt.toISOString(),
        date: ymd(e.date),
        pigment: s.name,
        kind: e.kind === "ADJUSTMENT" ? "adjust" : "in",
        reference: `${ENTRY_LABEL[e.kind]}${e.note ? ` — ${e.note}` : ""}`,
        quantity: num(e.quantity),
        unit: e.unit,
        inKg: num(e.quantityKg),
        outKg: 0,
        ref: null,
      });
    }
  }
  for (const fm of formulas) {
    const add = formulaAddition({ id: fm.id, serialNo: fm.serialNo, name: fm.name, date: ymd(fm.date), producedKg: num(fm.totalQuantityRequiredKg) });
    if (!stockByKey.has(add.nameKey)) continue;
    raw.push({
      ...blank,
      id: `f-${fm.id}`,
      key: add.nameKey,
      order: 1,
      at: fm.createdAt.toISOString(),
      date: add.date,
      pigment: stockByKey.get(add.nameKey)!.name,
      kind: "formula",
      reference: `Formula ${fm.name} produced (S.No. ${fm.serialNo})`,
      quantity: add.kg,
      unit: "KG",
      inKg: add.kg,
      outKg: 0,
      ref: { type: "formula", id: fm.id },
    });
  }
  for (const r of records) {
    const uses = productionPigmentUsage({
      date: ymd(r.date),
      totalCycles: r.totalCycles,
      mixers: r.mixers.map((m) => ({
        mixer: mixerLabel(m.kind, m.position),
        cycleTimeChanged: m.cycleTimeChanged,
        pigments: m.pigments.map((p) => ({ name: p.name, unit: p.unit, quantity: num(p.quantity) })),
        changes: m.cycleChanges.map((c) => ({
          fromCycle: c.fromCycle,
          toCycle: c.toCycle,
          pigments: c.pigments.map((p) => ({ name: p.name, unit: p.unit, quantity: num(p.quantity) })),
        })),
      })),
    });
    uses.forEach((u, i) => {
      raw.push({
        id: `p-${r.id}-${i}`,
        key: u.nameKey,
        order: 2,
        at: r.createdAt.toISOString(),
        date: u.date,
        pigment: u.name,
        kind: "production",
        reference: `Daily Production S.No. ${r.serialNo}`,
        batchNumber: r.batchNumber,
        locNumber: r.locNumber,
        designName: r.designName,
        mixer: u.mixer ?? "",
        range: u.range ? `${u.range.from}–${u.range.to}` : "",
        cycles: u.cycles,
        quantity: u.quantity,
        unit: u.unit,
        inKg: 0,
        outKg: u.kg,
        ref: { type: "production", id: r.id },
      });
    });
  }

  // Chronological per pigment: by date, then by when it was saved.
  raw.sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at) || a.order - b.order || a.id.localeCompare(b.id));
  const balance = new Map<string, number>();
  const withBalance: (PigmentTxn & { key: string })[] = raw.map(({ order: _order, at: _at, ...t }) => {
    const stock = stockByKey.get(t.key);
    let balanceKg: number | null = null;
    if (stock) {
      balanceKg = kg6((balance.get(t.key) ?? 0) + t.inKg - t.outKg);
      balance.set(t.key, balanceKg);
    }
    return { ...t, color: stock?.color ?? null, balanceKg };
  });

  const byBatchLoc = !!(f.batch || f.loc);
  const filtered = withBalance.filter(
    (t) =>
      (!f.pigment || includes(t.pigment, f.pigment)) &&
      inDates(t.date, f) &&
      (!byBatchLoc ||
        (t.kind === "production" &&
          (!f.batch || includes(t.batchNumber, f.batch)) &&
          (!f.loc || includes(t.locNumber, f.loc)))),
  );

  // One summary card per pigment in the results (or matching the name filter).
  const keys = new Set(filtered.map((t) => t.key));
  if (f.pigment && !byBatchLoc) for (const s of stocks) if (includes(s.name, f.pigment)) keys.add(s.nameKey);
  const summary: PigmentSummary[] = [...keys].map((key) => {
    const stock = stockByKey.get(key);
    const all = withBalance.filter((t) => t.key === key);
    const totalStockKg = kg6(all.reduce((s, t) => s + t.inKg, 0));
    const consumedAllKg = kg6(all.reduce((s, t) => s + t.outKg, 0));
    return {
      name: stock?.name ?? all[0]?.pigment ?? key,
      color: stock?.color ?? null,
      tracked: !!stock,
      totalStockKg,
      consumedAllKg,
      remainingKg: kg6(totalStockKg - consumedAllKg),
      consumedFilteredKg: kg6(filtered.filter((t) => t.key === key).reduce((s, t) => s + t.outKg, 0)),
    };
  });
  summary.sort((a, b) => a.name.localeCompare(b.name));

  return { rows: filtered.reverse().map(({ key: _key, ...t }) => t), summary };
}

// ---------------------------------------------------------------------------
// Materials — consumption only
// ---------------------------------------------------------------------------

export async function searchMaterials(
  f: Filters,
): Promise<{ rows: MaterialRow[]; daily: MaterialDaily[]; totals: { material: string; kg: number }[] }> {
  const mixerFilter = parseMixerFilter(f.mixer);
  const items = await prisma.productionMaterial.findMany({
    where: {
      ...(f.material ? { name: like(f.material) } : {}),
      mixer: {
        ...(mixerFilter ? { kind: mixerFilter.kind, position: mixerFilter.position } : {}),
        record: {
          ...(f.batch ? { batchNumber: like(f.batch) } : {}),
          ...(f.loc ? { locNumber: like(f.loc) } : {}),
          ...(dateRange(f) ? { date: dateRange(f) } : {}),
        },
      },
    },
    select: {
      id: true,
      name: true,
      nameKey: true,
      size: true,
      itemName: true,
      color: true,
      percent: true,
      unit: true,
      quantity: true,
      mixer: {
        select: {
          kind: true,
          position: true,
          record: { select: { id: true, serialNo: true, date: true, batchNumber: true, locNumber: true, designName: true } },
        },
      },
    },
  });

  const rows: MaterialRow[] = items
    .map((x) => ({
      id: x.id,
      date: ymd(x.mixer.record.date),
      batchNumber: x.mixer.record.batchNumber,
      locNumber: x.mixer.record.locNumber,
      designName: x.mixer.record.designName,
      mixer: mixerLabel(x.mixer.kind, x.mixer.position),
      material: x.name,
      detail: materialDetail({ ...x, percent: x.percent === null ? null : num(x.percent) }),
      unit: x.unit,
      quantity: num(x.quantity),
      kg: kg6(toKg(num(x.quantity), x.unit)),
      recordId: x.mixer.record.id,
      key: x.nameKey,
      serial: x.mixer.record.serialNo,
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.serial - a.serial)
    .map(({ key: _k, serial: _s, ...r }) => r);

  // Daily totals per material, with the running (cumulative) total by date.
  const dayMap = new Map<string, { date: string; material: string; key: string; kg: number }>();
  for (const r of rows) {
    const key = nameKey(r.material);
    const id = `${r.date}|${key}`;
    const d = dayMap.get(id) ?? { date: r.date, material: r.material, key, kg: 0 };
    d.kg = kg6(d.kg + r.kg);
    dayMap.set(id, d);
  }
  const running = new Map<string, number>();
  const daily: MaterialDaily[] = [...dayMap.values()]
    .sort((a, b) => a.date.localeCompare(b.date) || a.material.localeCompare(b.material))
    .map((d) => {
      const cumulativeKg = kg6((running.get(d.key) ?? 0) + d.kg);
      running.set(d.key, cumulativeKg);
      return { date: d.date, material: d.material, kg: d.kg, cumulativeKg };
    })
    .reverse();

  const names = new Map<string, string>();
  for (const d of daily) if (!names.has(nameKey(d.material))) names.set(nameKey(d.material), d.material);
  const totals = [...running]
    .map(([key, kg]) => ({ material: names.get(key) ?? key, kg }))
    .sort((a, b) => b.kg - a.kg);

  return { rows, daily, totals };
}

// ---------------------------------------------------------------------------
// Suggestions for the filter fields
// ---------------------------------------------------------------------------

function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, string>();
  for (const n of names) if (n && !seen.has(nameKey(n))) seen.set(nameKey(n), n);
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

export async function getSearchSuggestions(): Promise<SearchSuggestions> {
  const [formulas, formulaItems, stocks, prodPigments, records, materials] = await Promise.all([
    prisma.formula.findMany({ select: { name: true } }),
    prisma.formulaItem.findMany({ select: { name: true }, distinct: ["name"] }),
    prisma.pigmentStock.findMany({ select: { name: true } }),
    prisma.productionPigment.findMany({ select: { name: true }, distinct: ["nameKey"] }),
    prisma.productionRecord.findMany({ select: { batchNumber: true, locNumber: true, designName: true } }),
    prisma.productionMaterial.findMany({ select: { name: true }, distinct: ["nameKey"] }),
  ]);
  return {
    formulaNames: uniqueNames(formulas.map((f) => f.name)),
    formulaMaterials: uniqueNames(formulaItems.map((i) => i.name)),
    pigments: uniqueNames([...stocks.map((s) => s.name), ...prodPigments.map((p) => p.name), ...formulas.map((f) => f.name)]),
    batches: uniqueNames(records.map((r) => r.batchNumber)),
    locs: uniqueNames(records.map((r) => r.locNumber)),
    designs: uniqueNames(records.map((r) => r.designName)),
    materials: uniqueNames(materials.map((m) => m.name)),
  };
}
