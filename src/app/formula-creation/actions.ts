"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { calculateRequirement } from "@/lib/formula/calc";
import { formulaInputSchema } from "@/lib/formula/schema";
import { defaultSwatch } from "@/lib/stock/consumption";
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
 * Names are matched on nameKey, so "sp yellow" finds "SP Yellow"; when a
 * formula name has been saved several times, the latest one is used.
 *
 * STOCK: the same formula name may be saved again for each new production.
 * The formula gets a stock row (created on first save), and its Total
 * Quantity Required counts as stock produced — read from this record by the
 * stock ledger, so it is added exactly once. Ingredients are not deducted.
 *
 * EDIT: with `editId` the same record is updated in place (its rows are
 * replaced); no new formula is created. Stock follows automatically, because
 * it is read from the saved records.
 */
export async function saveFormula(raw: unknown, editId?: string): Promise<SaveFormulaResult> {
  if (editId !== undefined && (typeof editId !== "string" || !editId || editId.length > 64)) {
    return { ok: false, error: "Unknown formula." };
  }
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
      const existing = editId
        ? await tx.formula.findUnique({ where: { id: editId }, select: { nameKey: true } })
        : null;
      if (editId && !existing) throw new FieldError("", "This formula no longer exists.");

      const serialTaken = await tx.formula.findFirst({
        where: { serialNo, ...(editId ? { NOT: { id: editId } } : {}) },
        select: { id: true },
      });
      if (serialTaken) throw new FieldError("serialNo", `S.No. ${serialNo} is already used`);

      const keys = [...new Set(items.map((i) => i.key))];
      const components = await tx.formula.findMany({
        where: { nameKey: { in: keys }, ...(editId ? { NOT: { id: editId } } : {}) },
        select: { id: true, nameKey: true },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }], // later entries win below: the latest formula
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

      // The formula's stock row (its production is added to it).
      await tx.pigmentStock.upsert({
        where: { nameKey: formulaKey },
        update: {},
        create: { name: formulaName, nameKey: formulaKey, color: defaultSwatch(formulaName) },
      });

      const data = {
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
      };
      const select = { id: true, name: true, serialNo: true } as const;

      if (!editId) return tx.formula.create({ data, select });
      await tx.formulaItem.deleteMany({ where: { formulaId: editId } });
      const updated = await tx.formula.update({ where: { id: editId }, data, select });
      if (existing && existing.nameKey !== formulaKey) await removeUnusedStockRow(tx, existing.nameKey);
      return updated;
    });

    revalidatePath("/formula-creation");
    revalidatePath("/stocks-consumption");
    revalidatePath("/dashboard");
    return { ok: true, ...formula };
  } catch (err) {
    if (err instanceof FieldError) {
      return { ok: false, error: err.message, fieldErrors: err.field ? { [err.field]: err.message } : undefined };
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

type Tx = Prisma.TransactionClient;

/** Drops a formula's stock row once nothing gives it meaning: no formula of
 *  that name remains, it has no manual entries, no Daily Production used it
 *  and no minimum is set. Otherwise it stays (its history still counts). */
async function removeUnusedStockRow(tx: Tx, key: string) {
  const [formulas, row, used] = await Promise.all([
    tx.formula.count({ where: { nameKey: key } }),
    tx.pigmentStock.findUnique({ where: { nameKey: key }, select: { id: true, minStockKg: true, _count: { select: { entries: true } } } }),
    tx.productionPigment.count({ where: { nameKey: key } }),
  ]);
  if (row && formulas === 0 && used === 0 && row._count.entries === 0 && row.minStockKg === null) {
    await tx.pigmentStock.delete({ where: { id: row.id } });
  }
}

/**
 * DELETE FORMULA — removes the formula and its rows. Records that point at it
 * are re-pointed rather than broken: another formula using it as an
 * ingredient, and Daily Production rows that used it, move to the latest
 * other formula of the same name; if there is none, the ingredient becomes a
 * plain material and the production row keeps its name. Its stock addition
 * disappears with it (stock is read from the records).
 */
export async function deleteFormula(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof id !== "string" || !id || id.length > 64) return { ok: false, error: "Unknown formula." };
  try {
    await prisma.$transaction(async (tx) => {
      const formula = await tx.formula.findUnique({ where: { id }, select: { name: true, nameKey: true } });
      if (!formula) throw new FieldError("", "This formula no longer exists.");
      const replacement = await tx.formula.findFirst({
        where: { nameKey: formula.nameKey, NOT: { id } },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        select: { id: true },
      });
      if (replacement) {
        await tx.formulaItem.updateMany({ where: { componentFormulaId: id }, data: { componentFormulaId: replacement.id } });
      } else if (await tx.formulaItem.count({ where: { componentFormulaId: id } })) {
        const material = await tx.material.upsert({
          where: { nameKey: formula.nameKey },
          update: {},
          create: { name: formula.name, nameKey: formula.nameKey },
          select: { id: true },
        });
        await tx.formulaItem.updateMany({ where: { componentFormulaId: id }, data: { componentFormulaId: null, materialId: material.id } });
      }
      await tx.productionPigment.updateMany({ where: { formulaId: id }, data: { formulaId: replacement?.id ?? null } });
      await tx.formula.delete({ where: { id } });
      await removeUnusedStockRow(tx, formula.nameKey);
    });
  } catch (err) {
    if (err instanceof FieldError) return { ok: false, error: err.message };
    console.error("deleteFormula failed", err);
    return { ok: false, error: "The formula could not be deleted. Please try again." };
  }
  for (const path of ["/formula-creation", "/stocks-consumption", "/dashboard", "/searching", "/reports"]) revalidatePath(path);
  return { ok: true };
}
