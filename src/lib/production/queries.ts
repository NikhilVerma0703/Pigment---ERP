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
  const [batchNumbers, locNumbers, designNames, formulas, colors, others] = await Promise.all([
    distinct("batchNumber"),
    distinct("locNumber"),
    distinct("designName"),
    prisma.formula.findMany({ select: { id: true, name: true, nameKey: true }, orderBy: { name: "asc" } }),
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
  };
}

export async function getNextProductionSerialNo(): Promise<number> {
  const { _max } = await prisma.productionRecord.aggregate({ _max: { serialNo: true } });
  return (_max.serialNo ?? 0) + 1;
}
