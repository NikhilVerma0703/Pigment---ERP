import "server-only";
import { prisma } from "@/lib/prisma";
import { valueSuggestions, type Suggestion } from "@/lib/suggestions";

export interface ProductionSuggestions {
  batchNumbers: Suggestion[];
  locNumbers: Suggestion[];
  designNames: Suggestion[];
  /** Saved formulas first, then colours typed by hand on earlier records. */
  pigments: Suggestion[];
  /** Names entered under "+ Add/Others" on earlier records. */
  otherMaterials: Suggestion[];
  /** Earlier entry names per material (Grit Name, Resin Name, …). */
  materialNames: Record<string, Suggestion[]>;
  /** Earlier Grit / Powder colours. */
  materialColors: Suggestion[];
}

async function distinct(column: "batchNumber" | "locNumber" | "designName"): Promise<string[]> {
  const rows = await prisma.productionRecord.findMany({
    select: { [column]: true },
    distinct: [column],
    orderBy: { [column]: "asc" },
  });
  return rows.map((r) => (r as unknown as Record<string, string>)[column]);
}

/** Earlier names, one per case-insensitive key (the first spelling seen). */
function uniqueByKey(rows: { name: string; nameKey: string }[]): string[] {
  const seen = new Map<string, string>();
  for (const r of rows) if (!seen.has(r.nameKey)) seen.set(r.nameKey, r.name);
  return [...seen.values()];
}

export async function getProductionSuggestions(): Promise<ProductionSuggestions> {
  const [batchNumbers, locNumbers, designNames, formulas, colors, others, entryNames, entryColors] = await Promise.all([
    distinct("batchNumber"),
    distinct("locNumber"),
    distinct("designName"),
    prisma.formula.findMany({ select: { id: true, name: true, nameKey: true }, distinct: ["nameKey"], orderBy: [{ nameKey: "asc" }, { createdAt: "desc" }] }),
    prisma.productionPigment.findMany({
      where: { formulaId: null },
      select: { name: true, nameKey: true },
      distinct: ["nameKey"],
      orderBy: { nameKey: "asc" },
    }),
    prisma.productionMaterial.findMany({
      where: { isStandard: false },
      select: { name: true, nameKey: true },
      distinct: ["nameKey"],
      orderBy: { nameKey: "asc" },
    }),
    prisma.productionMaterial.findMany({
      where: { itemName: { not: null } },
      select: { category: true, itemName: true },
      distinct: ["category", "itemName"],
      orderBy: { itemName: "asc" },
    }),
    prisma.productionMaterial.findMany({
      where: { color: { not: null } },
      select: { color: true },
      distinct: ["color"],
      orderBy: { color: "asc" },
    }),
  ]);

  // A hand-typed colour that has since been saved as a formula is offered once, as the formula.
  const formulaKeys = new Set(formulas.map((f) => f.nameKey));
  const colorNames = uniqueByKey(colors.filter((c) => !formulaKeys.has(c.nameKey)));

  return {
    batchNumbers: valueSuggestions(batchNumbers),
    locNumbers: valueSuggestions(locNumbers),
    designNames: valueSuggestions(designNames),
    pigments: [
      ...formulas.map((f) => ({ kind: "formula" as const, id: f.id, name: f.name })),
      ...colorNames.map((n) => ({ kind: "color" as const, id: n, name: n })),
    ],
    otherMaterials: uniqueByKey(others).map((n) => ({ kind: "material" as const, id: n, name: n })),
    materialNames: entryNames.reduce<Record<string, Suggestion[]>>((acc, e) => {
      (acc[e.category] ??= []).push({ kind: "value", id: e.itemName!, name: e.itemName! });
      return acc;
    }, {}),
    materialColors: valueSuggestions(entryColors.map((c) => c.color!)),
  };
}

export async function getNextProductionSerialNo(): Promise<number> {
  const { _max } = await prisma.productionRecord.aggregate({ _max: { serialNo: true } });
  return (_max.serialNo ?? 0) + 1;
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
  roymixUsed: boolean;
}

/** The latest saved Daily Production records: by production date, then by
 *  when they were saved, newest first. */
export async function getRecentProduction(limit = 10): Promise<RecentProduction[]> {
  const rows = await prisma.productionRecord.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: { id: true, date: true, serialNo: true, batchNumber: true, locNumber: true, designName: true, totalCycles: true, mixersUsed: true, roymixUsed: true },
  });
  return rows.map((r) => ({ ...r, date: r.date.toISOString().slice(0, 10) }));
}
