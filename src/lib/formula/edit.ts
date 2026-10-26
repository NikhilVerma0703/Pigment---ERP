import "server-only";
import { prisma } from "@/lib/prisma";
import type { FormulaInput } from "@/lib/formula/schema";

/** A decimal as the form expects it: "32", "12.985" (no trailing zeros). */
const str = (d: { toString(): string }) => String(Number(d.toString()));

/** A saved formula as Formula Creation form values, for Edit. */
export async function getFormulaForEdit(id: string): Promise<{ id: string; serialNo: number; name: string; values: FormulaInput } | null> {
  if (!id || id.length > 64) return null;
  const f = await prisma.formula.findUnique({
    where: { id },
    select: {
      id: true,
      date: true,
      serialNo: true,
      formulaType: true,
      name: true,
      mixingHours: true,
      mixingMinutes: true,
      totalQuantityRequiredKg: true,
      items: { orderBy: { lineNo: "asc" }, select: { name: true, unit: true, quantity: true } },
    },
  });
  if (!f) return null;
  return {
    id: f.id,
    serialNo: f.serialNo,
    name: f.name,
    values: {
      date: f.date.toISOString().slice(0, 10),
      serialNo: String(f.serialNo),
      formulaType: f.formulaType,
      name: f.name,
      mixingHours: f.mixingHours ? String(f.mixingHours) : "",
      mixingMinutes: f.mixingMinutes ? String(f.mixingMinutes) : "",
      items: f.items.map((i) => ({ name: i.name, unit: i.unit, quantity: str(i.quantity) })),
      totalQuantityRequired: str(f.totalQuantityRequiredKg),
    },
  };
}
