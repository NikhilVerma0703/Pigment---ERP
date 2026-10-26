"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { slotMixer } from "@/lib/production/constants";
import { isPercentCategory, materialSpec, percentQuantity, resinKg } from "@/lib/production/materials";
import {
  activeMixerSlots,
  materialEntryUsed,
  productionInputSchema,
  type MaterialRowInput,
  type PigmentRowInput,
} from "@/lib/production/schema";
import { cleanName, nameKey } from "@/lib/utils";

export type SaveProductionResult =
  | { ok: true; id: string; serialNo: number }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * SAVE DAILY PRODUCTION — validates the whole form again on the server and
 * writes the record, its mixers, pigment rows, cycle changes and materials in
 * one transaction.
 *
 * Only the active mixers are saved: Mixer 1 … Mixer N and, when Roymix Used
 * is Yes, the Roymix Mixer (the form keeps every slot so changing either
 * field does not lose typing). Blank rows are dropped. A
 * pigment whose name matches a saved formula (case-insensitive) is linked to
 * that formula; any other name is stored as a hand-entered colour.
 */
export async function saveProduction(raw: unknown, editId?: string): Promise<SaveProductionResult> {
  if (editId !== undefined && (typeof editId !== "string" || !editId || editId.length > 64)) {
    return { ok: false, error: "Unknown production record." };
  }
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
  const mixers = activeMixerSlots(input.mixersUsed, input.roymixUsed).map((slot) => ({
    ...input.mixers[slot],
    ...slotMixer(slot),
  }));

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

  // Materials: untouched entries are dropped. `name` is the material (or the
  // custom name for Others), so totals group by it; Catalyst / Cobalt / Silane
  // quantities are recalculated here from the percentage and the mixer's resin.
  const materialRows = (rows: MaterialRowInput[]) => {
    const resin = resinKg(rows);
    const opt = (v: string) => cleanName(v) || null;
    return rows.filter(materialEntryUsed).map((r, i) => {
      const name = r.category === "OTHER" ? cleanName(r.name) : materialSpec(r.category).label;
      const pct = isPercentCategory(r.category);
      const quantity = pct ? (percentQuantity(r.percent, r.unit, resin) ?? 0) : Number(r.quantity.trim());
      return {
        lineNo: i + 1,
        category: r.category,
        name,
        nameKey: nameKey(name),
        isStandard: r.category !== "OTHER",
        size: opt(r.size),
        itemName: opt(r.itemName),
        color: opt(r.color),
        percent: pct ? new Prisma.Decimal(r.percent.trim()) : null,
        unit: r.unit,
        quantity: new Prisma.Decimal(quantity),
      };
    });
  };

  try {
    const record = await prisma.$transaction(async (tx) => {
      if (editId && !(await tx.productionRecord.findUnique({ where: { id: editId }, select: { id: true } }))) {
        throw new FieldError("", "This production record no longer exists.");
      }
      if (await tx.productionRecord.findFirst({ where: { serialNo, ...(editId ? { NOT: { id: editId } } : {}) }, select: { id: true } })) {
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
        orderBy: [{ date: "asc" }, { createdAt: "asc" }], // later entries win below: the latest formula
      });
      const formulaByKey = new Map(formulas.map((f) => [f.nameKey, f.id]));
      const withFormula = <T extends { nameKey: string }>(row: T) => ({
        ...row,
        formulaId: formulaByKey.get(row.nameKey) ?? null,
      });

      // EDIT: the same record is updated in place and its mixers (with their
      // pigments, cycle changes and materials) are replaced, so nothing is
      // duplicated. Stock and consumption follow, being read from the records.
      if (editId) await tx.productionMixer.deleteMany({ where: { recordId: editId } });
      const recordData = {
        date: new Date(`${input.date}T00:00:00.000Z`),
        serialNo,
        batchNumber: cleanName(input.batchNumber),
        locNumber: cleanName(input.locNumber),
        designName: cleanName(input.designName),
        totalCycles: Number(input.totalCycles),
        mixersUsed: Number(input.mixersUsed),
        roymixUsed: input.roymixUsed === "YES",
      };
      const created = editId
        ? await tx.productionRecord.update({ where: { id: editId }, data: recordData, select: { id: true, serialNo: true } })
        : await tx.productionRecord.create({ data: recordData, select: { id: true, serialNo: true } });

      for (const m of mixers) {
        const changed = m.cycleTimeChanged === "YES";
        const mixer = await tx.productionMixer.create({
          data: {
            recordId: created.id,
            kind: m.kind,
            position: m.position,
            cycleTimeChanged: changed,
            changeCount: changed ? m.changes.length : 0,
            pigments: { create: filledPigments(m.pigments).map(withFormula) },
            materials: { create: materialRows(m.materials) },
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
      return { ok: false, error: err.message, fieldErrors: err.field ? { [err.field]: err.message } : undefined };
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

/**
 * DELETE PRODUCTION RECORD — removes the record with its mixers, pigments,
 * cycle changes and materials. Its pigment consumption and material
 * consumption disappear with it everywhere (they are read from the records).
 */
export async function deleteProduction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof id !== "string" || !id || id.length > 64) return { ok: false, error: "Unknown production record." };
  try {
    const { count } = await prisma.productionRecord.deleteMany({ where: { id } });
    if (count === 0) return { ok: false, error: "This production record no longer exists." };
  } catch (err) {
    console.error("deleteProduction failed", err);
    return { ok: false, error: "The record could not be deleted. Please try again." };
  }
  for (const path of ["/pigment-packing", "/stocks-consumption", "/dashboard", "/searching", "/reports"]) revalidatePath(path);
  return { ok: true };
}
