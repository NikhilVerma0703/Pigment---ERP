"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { calculateRequirement } from "@/lib/formula/calc";
import { formulaInputSchema } from "@/lib/formula/schema";
import { cleanName, nameKey } from "@/lib/utils";

export type SaveFormulaResult =
  | { ok: true; id: string; name: string; serialNo: number }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * SAVE FORMULA — validates the form again on the server, recomputes every
 * Requirement Table figure from the entered quantities (the browser's numbers
 * are never stored), and writes the formula, its rows and any new materials
 * in one transaction.
 *
 * Each row's name is resolved here, not trusted from the client:
 *   1. a saved formula of that name → the row uses that formula as an
 *      ingredient (componentFormulaId);
 *   2. otherwise a material of that name, created on first use (materialId).
 * Names are matched on nameKey, so "sp yellow" finds "SP Yellow".
 */
export async function saveFormula(raw: unknown): Promise<SaveFormulaResult> {
  const parsed = formulaInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Please correct the highlighted fields.", fieldErrors };
  }
  const input = parsed.data;

  const formulaName = cleanName(input.name);
  const formulaKey = nameKey(input.name);
  const serialNo = Number(input.serialNo);
  const items = input.items.map((item, i) => ({
    lineNo: i + 1,
    name: cleanName(item.name),
    key: nameKey(item.name),
    unit: item.unit,
    quantity: Number(item.quantity),
  }));

  const selfRow = items.find((i) => i.key === formulaKey);
  if (selfRow) {
    return {
      ok: false,
      error: "A formula cannot use itself as a material.",
      fieldErrors: { [`items.${selfRow.lineNo - 1}.name`]: "A formula cannot use itself as a material" },
    };
  }

  const calc = calculateRequirement(items, Number(input.totalQuantityRequired));
  if (calc.consumptionRate === null) {
    return { ok: false, error: "Total Quantity Used and Total Quantity Required must both be greater than 0." };
  }
  const rate = calc.consumptionRate;

  try {
    const formula = await prisma.$transaction(async (tx) => {
      const [taken, serialTaken] = await Promise.all([
        tx.formula.findUnique({ where: { nameKey: formulaKey }, select: { id: true } }),
        tx.formula.findUnique({ where: { serialNo }, select: { id: true } }),
      ]);
      if (taken) throw new FieldError("name", `A formula named "${formulaName}" already exists`);
      if (serialTaken) throw new FieldError("serialNo", `S.No. ${serialNo} is already used`);

      const keys = [...new Set(items.map((i) => i.key))];
      const components = await tx.formula.findMany({
        where: { nameKey: { in: keys } },
        select: { id: true, nameKey: true },
      });
      const componentByKey = new Map(components.map((c) => [c.nameKey, c.id]));

      const materialByKey = new Map<string, string>();
      for (const item of items) {
        if (componentByKey.has(item.key) || materialByKey.has(item.key)) continue;
        const material = await tx.material.upsert({
          where: { nameKey: item.key },
          update: {},
          create: { name: item.name, nameKey: item.key },
          select: { id: true },
        });
        materialByKey.set(item.key, material.id);
      }

      return tx.formula.create({
        data: {
          date: new Date(`${input.date}T00:00:00.000Z`),
          serialNo,
          formulaType: input.formulaType,
          name: formulaName,
          nameKey: formulaKey,
          mixingHours: input.mixingHours === "" ? 0 : Number(input.mixingHours),
          mixingMinutes: input.mixingMinutes === "" ? 0 : Number(input.mixingMinutes),
          totalQuantityUsedKg: new Prisma.Decimal(calc.totalUsedKg),
          totalQuantityRequiredKg: new Prisma.Decimal(calc.totalRequiredKg),
          consumptionRate: new Prisma.Decimal(rate),
          items: {
            create: items.map((item, i) => ({
              lineNo: item.lineNo,
              name: item.name,
              unit: item.unit,
              quantity: new Prisma.Decimal(item.quantity),
              requiredQuantity: new Prisma.Decimal(calc.requiredQuantities[i] ?? 0),
              componentFormulaId: componentByKey.get(item.key) ?? null,
              materialId: componentByKey.has(item.key) ? null : materialByKey.get(item.key) ?? null,
            })),
          },
        },
        select: { id: true, name: true, serialNo: true },
      });
    });

    revalidatePath("/formula-creation");
    revalidatePath("/stocks-consumption");
    return { ok: true, ...formula };
  } catch (err) {
    if (err instanceof FieldError) {
      return { ok: false, error: err.message, fieldErrors: { [err.field]: err.message } };
    }
    // Two saves racing past the checks above meet the unique indexes instead.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002" &&
      err.meta?.modelName === "Formula"
    ) {
      const target = String((err.meta?.target as string[] | string | undefined) ?? "").toLowerCase();
      if (target.includes("serial")) {
        return { ok: false, error: `S.No. ${serialNo} is already used`, fieldErrors: { serialNo: `S.No. ${serialNo} is already used` } };
      }
      if (target.includes("name")) {
        const message = `A formula named "${formulaName}" already exists`;
        return { ok: false, error: message, fieldErrors: { name: message } };
      }
    }
    console.error("saveFormula failed", err);
    return { ok: false, error: "The formula could not be saved. Please try again." };
  }
}

class FieldError extends Error {
  constructor(readonly field: string, message: string) {
    super(message);
  }
}
