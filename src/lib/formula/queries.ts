import "server-only";
import { prisma } from "@/lib/prisma";
import { formatQty } from "@/lib/formula/calc";
import { formulaTypeLabel } from "@/lib/formula/constants";
import type { Suggestion } from "@/lib/suggestions";

/** Every saved formula, A–Z, as suggestions. */
export async function getFormulaSuggestions(): Promise<Suggestion[]> {
  const formulas = await prisma.formula.findMany({ select: { id: true, name: true }, distinct: ["nameKey"], orderBy: [{ nameKey: "asc" }, { createdAt: "desc" }] });
  return formulas.map((f) => ({ kind: "formula" as const, id: f.id, name: f.name }));
}

/** Everything the "Material/Color Name" field can suggest: every saved
 *  formula (usable as an ingredient of another formula) and every material or
 *  colour entered before. A name that is both a formula and a material is
 *  offered once, as the formula — that is what the save action resolves it to. */
export async function getMaterialSuggestions(): Promise<Suggestion[]> {
  const [formulas, materials] = await Promise.all([
    prisma.formula.findMany({ select: { id: true, name: true, nameKey: true }, distinct: ["nameKey"], orderBy: [{ nameKey: "asc" }, { createdAt: "desc" }] }),
    prisma.material.findMany({ select: { id: true, name: true, nameKey: true }, orderBy: { name: "asc" } }),
  ]);
  const formulaKeys = new Set(formulas.map((f) => f.nameKey));
  return [
    ...formulas.map((f) => ({ kind: "formula" as const, id: f.id, name: f.name })),
    ...materials
      .filter((m) => !formulaKeys.has(m.nameKey))
      .map((m) => ({ kind: "material" as const, id: m.id, name: m.name })),
  ];
}

export async function getNextSerialNo(): Promise<number> {
  const { _max } = await prisma.formula.aggregate({ _max: { serialNo: true } });
  return (_max.serialNo ?? 0) + 1;
}

export interface LatestFormula {
  id: string;
  serialNo: number;
  date: string;
  name: string;
  typeLabel: string;
  /** "TiO2 23 kg, Yellow 22 kg" — quantities as entered. */
  ingredients: string;
  totalUsedKg: number;
  requiredKg: number;
  rate: number;
  mixing: string;
}

/** The latest saved formulas: by formula date, then by when they were saved, newest first. */
export async function getLatestFormulas(limit = 10): Promise<LatestFormula[]> {
  const rows = await prisma.formula.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: {
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
      items: { orderBy: { lineNo: "asc" }, select: { name: true, unit: true, quantity: true } },
    },
  });
  const num = (d: { toString(): string }) => Number(d.toString());
  return rows.map((f) => ({
    id: f.id,
    serialNo: f.serialNo,
    date: f.date.toISOString().slice(0, 10),
    name: f.name,
    typeLabel: formulaTypeLabel(f.formulaType),
    ingredients: f.items.map((i) => `${i.name} ${formatQty(num(i.quantity))} ${i.unit === "GM" ? "gm" : "kg"}`).join(", "),
    totalUsedKg: num(f.totalQuantityUsedKg),
    requiredKg: num(f.totalQuantityRequiredKg),
    rate: num(f.consumptionRate),
    mixing: `${f.mixingHours} h ${f.mixingMinutes} min`,
  }));
}
