import "server-only";
import { addDays, format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { round } from "@/lib/formula/calc";
import { formulaUsage, productionPigmentUsage, sumBy, type Usage } from "@/lib/stock/consumption";
import { DEFAULT_ANALYTICS_RANGE } from "@/lib/stock/constants";
import type { Suggestion } from "@/lib/suggestions";

export interface StockRow {
  id: string;
  name: string;
  color: string;
  totalKg: number;
  formulaKg: number;
  productionKg: number;
  consumedKg: number;
  remainingKg: number;
  /** Minimum Stock Level in kg, or null when not set. */
  minStockKg: number | null;
  /** Consumed within the analytics range. */
  periodConsumedKg: number;
}

export interface NamedKg {
  name: string;
  kg: number;
}

export interface StockPageData {
  stocks: StockRow[];
  /** Pigments used in Daily Production that have no stock entry yet. */
  untracked: NamedKg[];
  /** Days the analytics charts cover (7, 15 or 30). */
  rangeDays: number;
  trend: {
    dates: string[];
    series: { key: string; name: string }[];
    rows: Record<string, number | string>[];
  };
  materials: {
    /** Most recent record dates first. */
    dates: string[];
    rows: { name: string; byDate: Record<string, number>; totalKg: number }[];
  };
  /** Most consumed within the analytics range. */
  topPigments: NamedKg[];
  topMaterials: NamedKg[];
  pigmentSuggestions: Suggestion[];
}

const TREND_SERIES = 5;
const MATERIAL_DATES = 14;
const TOP_N = 10;

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const num = (d: { toString(): string }) => Number(d.toString());

/**
 * Every pigment's stock and every pigment usage, from the saved records. The
 * Stocks page and the Dashboard both read stock through this, so their
 * figures always agree.
 */
export async function loadPigmentLedger() {
  const [stocks, formulas, records] = await Promise.all([
    prisma.pigmentStock.findMany({
      select: { id: true, name: true, nameKey: true, color: true, minStockKg: true, entries: { select: { quantityKg: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.formula.findMany({
      select: { date: true, items: { select: { name: true, unit: true, requiredQuantity: true } } },
    }),
    prisma.productionRecord.findMany({
      select: {
        date: true,
        totalCycles: true,
        mixers: {
          select: {
            cycleTimeChanged: true,
            pigments: { where: { cycleChangeId: null }, select: { name: true, unit: true, quantity: true } },
            cycleChanges: {
              orderBy: { seq: "asc" },
              select: {
                fromCycle: true,
                toCycle: true,
                pigments: { select: { name: true, unit: true, quantity: true } },
              },
            },
            materials: { select: { name: true, nameKey: true, unit: true, quantity: true } },
          },
        },
      },
    }),
  ]);

  // ---- Pigment usage from both sources -----------------------------------
  const formulaUses: Usage[] = formulas.flatMap((f) =>
    formulaUsage({
      date: ymd(f.date),
      items: f.items.map((i) => ({ name: i.name, unit: i.unit, requiredQuantity: num(i.requiredQuantity) })),
    }),
  );
  const productionUses: Usage[] = records.flatMap((r) =>
    productionPigmentUsage({
      date: ymd(r.date),
      totalCycles: r.totalCycles,
      mixers: r.mixers.map((m) => ({
        cycleTimeChanged: m.cycleTimeChanged,
        pigments: m.pigments.map((p) => ({ name: p.name, unit: p.unit, quantity: num(p.quantity) })),
        changes: m.cycleChanges.map((c) => ({
          fromCycle: c.fromCycle,
          toCycle: c.toCycle,
          pigments: c.pigments.map((p) => ({ name: p.name, unit: p.unit, quantity: num(p.quantity) })),
        })),
      })),
    }),
  );

  // Only names on the stock list are pigments with stock. Formula rows also
  // include ingredients such as Resin, which are ignored unless stocked.
  const stockKeys = new Set(stocks.map((s) => s.nameKey));
  const formulaByKey = sumBy(formulaUses.filter((u) => stockKeys.has(u.nameKey)), (u) => u.nameKey, (u) => u.kg);
  const productionByKey = sumBy(productionUses.filter((u) => stockKeys.has(u.nameKey)), (u) => u.nameKey, (u) => u.kg);

  const stockRows: StockRow[] = stocks.map((s) => {
    const totalKg = round(s.entries.reduce((sum, e) => sum + num(e.quantityKg), 0), 6);
    const formulaKg = formulaByKey.get(s.nameKey) ?? 0;
    const productionKg = productionByKey.get(s.nameKey) ?? 0;
    const consumedKg = round(formulaKg + productionKg, 6);
    return {
      id: s.id,
      name: s.name,
      color: s.color,
      totalKg,
      formulaKg,
      productionKg,
      consumedKg,
      remainingKg: round(totalKg - consumedKg, 6),
      minStockKg: s.minStockKg === null ? null : num(s.minStockKg),
      periodConsumedKg: 0, // filled in by getStockPageData, once the range is known
    };
  });

  return { stocks, records, formulaUses, productionUses, stockKeys, stockRows };
}

export async function getStockPageData(rangeDays: number = DEFAULT_ANALYTICS_RANGE): Promise<StockPageData> {
  const { stocks, records, formulaUses, productionUses, stockKeys, stockRows } = await loadPigmentLedger();
  const tracked = [...formulaUses, ...productionUses].filter((u) => stockKeys.has(u.nameKey));
  const nameByKey = new Map(stocks.map((s) => [s.nameKey, s.name]));

  const untrackedTotals = sumBy(
    productionUses.filter((u) => !stockKeys.has(u.nameKey)),
    (u) => u.nameKey,
    (u) => u.kg,
  );
  const untrackedNames = new Map(productionUses.map((u) => [u.nameKey, u.name]));
  const untracked = [...untrackedTotals]
    .map(([k, kg]) => ({ name: untrackedNames.get(k) ?? k, kg }))
    .sort((a, b) => b.kg - a.kg);

  // ---- Analytics range: the last `rangeDays` days, today included --------
  const today = new Date();
  const dates = Array.from({ length: rangeDays }, (_, i) => format(addDays(today, i - rangeDays + 1), "yyyy-MM-dd"));
  const inRange = (date: string) => date >= dates[0] && date <= dates[dates.length - 1];
  const inWindow = tracked.filter((u) => inRange(u.date));
  const windowByKey = sumBy(inWindow, (u) => u.nameKey, (u) => u.kg);
  stocks.forEach((s, i) => (stockRows[i].periodConsumedKg = windowByKey.get(s.nameKey) ?? 0));
  const series = [...windowByKey]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TREND_SERIES)
    .map(([key]) => ({ key, name: nameByKey.get(key) ?? key }));
  const byDateKey = sumBy(inWindow, (u) => `${u.date}|${u.nameKey}`, (u) => u.kg);
  const byDate = sumBy(inWindow, (u) => u.date, (u) => u.kg);
  const trendRows = dates.map((date) => {
    const row: Record<string, number | string> = { date, total: byDate.get(date) ?? 0 };
    for (const s of series) row[s.key] = byDateKey.get(`${date}|${s.key}`) ?? 0;
    return row;
  });

  // ---- Materials: consumption only ---------------------------------------
  const materialUses = records.flatMap((r) =>
    r.mixers.flatMap((m) =>
      m.materials.map((x) => ({
        key: x.nameKey,
        name: x.name,
        date: ymd(r.date),
        kg: round(num(x.quantity) / (x.unit === "GM" ? 1000 : 1), 6),
      })),
    ),
  );
  const materialTotals = sumBy(materialUses, (u) => u.key, (u) => u.kg);
  const materialPeriod = sumBy(materialUses.filter((u) => inRange(u.date)), (u) => u.key, (u) => u.kg);
  const materialByDate = sumBy(materialUses, (u) => `${u.key}|${u.date}`, (u) => u.kg);
  const materialNames = new Map<string, string>();
  for (const u of materialUses) if (!materialNames.has(u.key)) materialNames.set(u.key, u.name);
  const materialDates = [...new Set(materialUses.map((u) => u.date))].sort().reverse().slice(0, MATERIAL_DATES);
  const materialRows = [...materialTotals]
    .sort((a, b) => b[1] - a[1])
    .map(([key, totalKg]) => ({
      name: materialNames.get(key) ?? key,
      totalKg,
      byDate: Object.fromEntries(
        materialDates.map((d) => [d, materialByDate.get(`${key}|${d}`) ?? 0]).filter(([, kg]) => (kg as number) > 0),
      ) as Record<string, number>,
    }));

  // ---- Suggestions for the stock name field ------------------------------
  const formulaNames = await prisma.formula.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  const seen = new Set<string>();
  const pigmentSuggestions: Suggestion[] = [];
  for (const f of formulaNames) {
    const k = f.name.trim().toLowerCase();
    if (!seen.has(k)) (seen.add(k), pigmentSuggestions.push({ kind: "formula", id: f.id, name: f.name }));
  }
  for (const [k, name] of untrackedNames) {
    if (!seen.has(k)) (seen.add(k), pigmentSuggestions.push({ kind: "color", id: k, name }));
  }
  for (const s of stocks) {
    if (!seen.has(s.nameKey)) (seen.add(s.nameKey), pigmentSuggestions.push({ kind: "color", id: s.id, name: s.name }));
  }

  return {
    stocks: stockRows,
    untracked,
    rangeDays,
    trend: { dates, series, rows: trendRows },
    materials: { dates: materialDates, rows: materialRows },
    topPigments: [...stockRows]
      .filter((s) => s.periodConsumedKg > 0)
      .sort((a, b) => b.periodConsumedKg - a.periodConsumedKg)
      .slice(0, TOP_N)
      .map((s) => ({ name: s.name, kg: s.periodConsumedKg })),
    topMaterials: [...materialPeriod]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_N)
      .map(([key, kg]) => ({ name: materialNames.get(key) ?? key, kg })),
    pigmentSuggestions,
  };
}
