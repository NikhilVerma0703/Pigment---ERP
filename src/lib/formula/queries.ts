import "server-only";
import { prisma } from "@/lib/prisma";
import type { Suggestion } from "@/lib/suggestions";

/** Every saved formula, A–Z, as suggestions. */
export async function getFormulaSuggestions(): Promise<Suggestion[]> {
  const formulas = await prisma.formula.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  return formulas.map((f) => ({ kind: "formula" as const, id: f.id, name: f.name }));
}

/** Everything the "Material/Color Name" field can suggest: every saved
 *  formula (usable as an ingredient of another formula) and every material or
 *  colour entered before. A name that is both a formula and a material is
 *  offered once, as the formula — that is what the save action resolves it to. */
export async function getMaterialSuggestions(): Promise<Suggestion[]> {
  const [formulas, materials] = await Promise.all([
    prisma.formula.findMany({ select: { id: true, name: true, nameKey: true }, orderBy: { name: "asc" } }),
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
