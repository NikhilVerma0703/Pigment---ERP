"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { productionInputSchema, type PigmentRowInput } from "@/lib/production/schema";
import { cleanName, nameKey } from "@/lib/utils";

export type SaveProductionResult =
  | { ok: true; id: string; serialNo: number }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * SAVE DAILY PRODUCTION — validates the whole form again on the server and
 * writes the record, its mixers, pigment rows, cycle changes and materials in
 * one transaction.
 *
 * Only the first `mixersUsed` mixers are saved (the form keeps all three so
 * switching the count does not lose typing). Blank rows are dropped. A
 * pigment whose name matches a saved formula (case-insensitive) is linked to
 * that formula; any other name is stored as a hand-entered colour.
 */
export async function saveProduction(raw: unknown): Promise<SaveProductionResult> {
  const parsed = productionInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Please correct the highlighted fields.", fieldErrors };
  }
  const input = parsed.data;
  const serialNo = Number(input.serialNo);
  const mixers = input.mixers.slice(0, Number(input.mixersUsed));

  const filledPigments = (rows: PigmentRowInput[]) =>
    rows
      .filter((r) => r.name.trim() || r.quantity.trim())
      .map((r, i) => ({
        lineNo: i + 1,
        name: cleanName(r.name),
        nameKey: nameKey(r.name),
        unit: r.unit,
        quantity: new Prisma.Decimal(r.quantity.trim()),
      }));

  try {
    const record = await prisma.$transaction(async (tx) => {
      if (await tx.productionRecord.findUnique({ where: { serialNo }, select: { id: true } })) {
        throw new FieldError("serialNo", `S.No. ${serialNo} is already used`);
      }

      const pigmentKeys = new Set<string>();
      for (const m of mixers) {
        for (const r of m.pigments) if (r.name.trim()) pigmentKeys.add(nameKey(r.name));
        for (const c of m.changes) for (const r of c.pigments) if (r.name.trim()) pigmentKeys.add(nameKey(r.name));
      }
      const formulas = await tx.formula.findMany({
        where: { nameKey: { in: [...pigmentKeys] } },
        select: { id: true, nameKey: true },
      });
      const formulaByKey = new Map(formulas.map((f) => [f.nameKey, f.id]));
      const withFormula = <T extends { nameKey: string }>(row: T) => ({
        ...row,
        formulaId: formulaByKey.get(row.nameKey) ?? null,
      });

      const created = await tx.productionRecord.create({
        data: {
          date: new Date(`${input.date}T00:00:00.000Z`),
          serialNo,
          batchNumber: cleanName(input.batchNumber),
          locNumber: cleanName(input.locNumber),
          designName: cleanName(input.designName),
          totalCycles: Number(input.totalCycles),
          mixersUsed: Number(input.mixersUsed),
        },
        select: { id: true, serialNo: true },
      });

      for (const m of mixers) {
        const changed = m.cycleTimeChanged === "YES";
        const mixer = await tx.productionMixer.create({
          data: {
            recordId: created.id,
            mixer: m.mixer,
            cycleTimeChanged: changed,
            changeCount: changed ? m.changes.length : 0,
            pigments: { create: filledPigments(m.pigments).map(withFormula) },
            materials: {
              create: m.materials
                .filter((r) => r.quantity.trim())
                .map((r, i) => ({
                  lineNo: i + 1,
                  name: cleanName(r.name),
                  nameKey: nameKey(r.name),
                  isStandard: r.isStandard,
                  unit: r.unit,
                  quantity: new Prisma.Decimal(r.quantity.trim()),
                })),
            },
          },
          select: { id: true },
        });

        if (!changed) continue;
        for (const [ci, c] of m.changes.entries()) {
          await tx.productionCycleChange.create({
            data: {
              mixerId: mixer.id,
              seq: ci + 1,
              fromCycle: Number(c.fromCycle),
              toCycle: Number(c.toCycle),
              pigments: {
                create: filledPigments(c.pigments).map((p) => ({ ...withFormula(p), mixerId: mixer.id })),
              },
            },
          });
        }
      }

      return created;
    });

    revalidatePath("/pigment-packing");
    revalidatePath("/stocks-consumption");
    return { ok: true, ...record };
  } catch (err) {
    if (err instanceof FieldError) {
      return { ok: false, error: err.message, fieldErrors: { [err.field]: err.message } };
    }
    // Two saves racing past the check above meet the unique index instead.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002" &&
      err.meta?.modelName === "ProductionRecord"
    ) {
      const message = `S.No. ${serialNo} is already used`;
      return { ok: false, error: message, fieldErrors: { serialNo: message } };
    }
    console.error("saveProduction failed", err);
    return { ok: false, error: "The production record could not be saved. Please try again." };
  }
}

class FieldError extends Error {
  constructor(readonly field: string, message: string) {
    super(message);
  }
}
