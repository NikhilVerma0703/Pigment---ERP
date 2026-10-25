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

export interface RecentProduction {
  id: string;
  date: string;
  serialNo: number;
  batchNumber: string;
  locNumber: string;
  designName: string;
  totalCycles: number;
  mixersUsed: number;
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
  recent: RecentProduction[];
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
export async function getDashboardData(): Promise<DashboardData> {
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const todayDate = new Date(`${today}T00:00:00.000Z`);

  const [ledger, formulasAll, formulasToday, productionToday, newStocks, entriesToday, recent] = await Promise.all([
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
      take: 10,
      select: { id: true, date: true, serialNo: true, batchNumber: true, locNumber: true, designName: true, totalCycles: true, mixersUsed: true },
    }),
  ]);

  // Today's pigment consumption: production pigments always count; formula
  // rows count only for pigments on the stock list (the Stocks page's rule).
  const usesToday = [
    ...ledger.productionUses,
    ...ledger.formulaUses.filter((u) => ledger.stockKeys.has(u.nameKey)),
  ].filter((u) => u.date === today);
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
    recent: recent.map((r) => ({ ...r, date: r.date.toISOString().slice(0, 10) })),
  };
}
