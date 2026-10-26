import "server-only";
import { format, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { round, toKg } from "@/lib/formula/calc";
import { sumBy } from "@/lib/stock/consumption";
import { loadPigmentLedger } from "@/lib/stock/queries";
import { nameKey } from "@/lib/utils";

export interface NamedKg {
  name: string;
  kg: number;
}

export interface DashboardData {
  today: string;
  overall: {
    pigments: number;
    productionRecords: number;
    formulas: number;
    remainingKg: number;
  };
  daily: {
    /** Pigments created on the stock list today. */
    newPigments: string[];
    /** Pigments already on the list that received stock today. */
    restockedPigments: string[];
    productionRecords: number;
    pigmentKg: number;
    pigments: NamedKg[];
    formulas: number;
    materialKg: number;
    materials: NamedKg[];
  };
  /** Every pigment/colour and formula on the stock list, A–Z. */
  pigmentNames: string[];
  /** Every saved production record, newest first, for Search Batch Number. */
  batchOptions: { id: string; label: string }[];
  /** Pigment Details Search: the selected pigment, when one is chosen. */
  pigmentDetail: PigmentDetail | null;
}

export interface PigmentDetail {
  name: string;
  /** Null when the name is not on the stock list. */
  stock: { totalKg: number; consumedKg: number; remainingKg: number; formulaKg: number } | null;
  /** The latest saved formula of this name, or null if it was never created as a formula. */
  formula: {
    id: string;
    serialNo: number;
    date: string;
    producedKg: number;
    /** How many times a formula of this name has been saved. */
    timesCreated: number;
    items: { lineNo: number; name: string; unit: "KG" | "GM"; quantity: number }[];
  } | null;
}

const kg6 = (n: number) => round(n, 6);
const num = (d: { toString(): string }) => Number(d.toString());

/**
 * Dashboard figures, all read from the saved records.
 *
 * "Today" is the server's calendar date. Production records, formulas and
 * consumption are counted by the date entered on the record (the production
 * date), which is how Stocks and Searching date them too. New pigments are
 * those first put on the stock list today; pigments already on the list that
 * got more stock today are listed separately.
 */
export async function getDashboardData(pigment?: string): Promise<DashboardData> {
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const todayDate = new Date(`${today}T00:00:00.000Z`);

  const [ledger, formulasAll, formulasToday, productionToday, newStocks, entriesToday, batches] = await Promise.all([
    loadPigmentLedger(),
    prisma.formula.count(),
    prisma.formula.count({ where: { date: todayDate } }),
    prisma.productionRecord.count({ where: { date: todayDate } }),
    prisma.pigmentStock.findMany({ where: { createdAt: { gte: startOfDay(now) } }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.pigmentStockEntry.findMany({
      where: { date: todayDate, pigment: { createdAt: { lt: startOfDay(now) } } },
      select: { pigment: { select: { name: true } } },
    }),
    prisma.productionRecord.findMany({
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: { id: true, batchNumber: true, date: true, serialNo: true },
    }),
  ]);

  // Today's pigment consumption: Daily Production only (formulas add stock).
  const usesToday = ledger.productionUses.filter((u) => u.date === today);
  const pigmentNames = new Map(usesToday.map((u) => [u.nameKey, u.name]));
  for (const s of ledger.stocks) if (pigmentNames.has(s.nameKey)) pigmentNames.set(s.nameKey, s.name);
  const pigments = [...sumBy(usesToday, (u) => u.nameKey, (u) => u.kg)]
    .map(([k, kg]) => ({ name: pigmentNames.get(k) ?? k, kg }))
    .sort((a, b) => b.kg - a.kg);

  // Today's materials: consumption only.
  const materialRows = ledger.records
    .filter((r) => r.date.toISOString().slice(0, 10) === today)
    .flatMap((r) => r.mixers.flatMap((m) => m.materials))
    .map((x) => ({ key: x.nameKey, name: x.name, kg: kg6(toKg(num(x.quantity), x.unit)) }));
  const materialNames = new Map<string, string>();
  for (const x of materialRows) if (!materialNames.has(x.key)) materialNames.set(x.key, x.name);
  const materials = [...sumBy(materialRows, (x) => x.key, (x) => x.kg)]
    .map(([k, kg]) => ({ name: materialNames.get(k) ?? k, kg }))
    .sort((a, b) => b.kg - a.kg);

  const restocked = new Map<string, string>();
  for (const e of entriesToday) restocked.set(nameKey(e.pigment.name), e.pigment.name);

  return {
    today,
    overall: {
      pigments: ledger.stocks.length,
      productionRecords: ledger.records.length,
      formulas: formulasAll,
      remainingKg: kg6(ledger.stockRows.reduce((s, r) => s + r.remainingKg, 0)),
    },
    daily: {
      newPigments: newStocks.map((s) => s.name),
      restockedPigments: [...restocked.values()].sort((a, b) => a.localeCompare(b)),
      productionRecords: productionToday,
      pigmentKg: kg6(pigments.reduce((s, p) => s + p.kg, 0)),
      pigments,
      formulas: formulasToday,
      materialKg: kg6(materials.reduce((s, m) => s + m.kg, 0)),
      materials,
    },
    batchOptions: batchOptions(batches),
    pigmentNames: ledger.stocks.map((s) => s.name).sort((a, b) => a.localeCompare(b)),
    pigmentDetail: pigment ? await getPigmentDetail(pigment, ledger.stockRows, ledger.stocks) : null,
  };
}

/**
 * Pigment Details Search: the pigment's current stock (from the same ledger as
 * everywhere else) and the ingredients of the LATEST formula saved under its
 * name — even when that formula has been created several times.
 */
async function getPigmentDetail(
  pigment: string,
  stockRows: { name: string; totalKg: number; consumedKg: number; remainingKg: number; formulaKg: number }[],
  stocks: { nameKey: string }[],
): Promise<PigmentDetail | null> {
  const key = nameKey(pigment);
  if (!key) return null;
  const i = stocks.findIndex((s) => s.nameKey === key);
  const row = i === -1 ? null : stockRows[i];

  const [latest, timesCreated] = await Promise.all([
    prisma.formula.findFirst({
      where: { nameKey: key },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        serialNo: true,
        name: true,
        date: true,
        totalQuantityRequiredKg: true,
        items: { orderBy: { lineNo: "asc" }, select: { lineNo: true, name: true, unit: true, quantity: true } },
      },
    }),
    prisma.formula.count({ where: { nameKey: key } }),
  ]);
  if (!row && !latest) return null;

  return {
    name: row?.name ?? latest?.name ?? pigment,
    stock: row
      ? { totalKg: row.totalKg, consumedKg: row.consumedKg, remainingKg: row.remainingKg, formulaKg: row.formulaKg }
      : null,
    formula: latest
      ? {
          id: latest.id,
          serialNo: latest.serialNo,
          date: latest.date.toISOString().slice(0, 10),
          producedKg: num(latest.totalQuantityRequiredKg),
          timesCreated,
          items: latest.items.map((it) => ({ lineNo: it.lineNo, name: it.name, unit: it.unit, quantity: num(it.quantity) })),
        }
      : null,
  };
}

/** One option per record. A batch number saved more than once is told apart
 *  by its date and S.No., so every option opens exactly one record. */
function batchOptions(rows: { id: string; batchNumber: string; date: Date; serialNo: number }[]): { id: string; label: string }[] {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(nameKey(r.batchNumber), (counts.get(nameKey(r.batchNumber)) ?? 0) + 1);
  return rows.map((r) => ({
    id: r.id,
    label:
      (counts.get(nameKey(r.batchNumber)) ?? 0) > 1
        ? `${r.batchNumber} (${format(r.date, "dd MMM yyyy")}, S.No. ${r.serialNo})`
        : r.batchNumber,
  }));
}
