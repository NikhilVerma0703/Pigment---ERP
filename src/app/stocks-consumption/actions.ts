"use server";

import { Prisma } from "@prisma/client";
import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { round, toKg } from "@/lib/formula/calc";
import { defaultSwatch } from "@/lib/stock/consumption";
import { stockInputSchema } from "@/lib/stock/schema";
import { cleanName, nameKey } from "@/lib/utils";

/**
 * MINIMUM STOCK LEVEL — sets (or, with "", clears) a pigment's minimum in kg.
 * Remaining at or below it shows as Low Stock in Low Stock Alerts.
 */
export async function setMinStock(pigmentId: string, raw: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const value = String(raw ?? "").trim();
  if (value !== "" && !/^\d+(\.\d{1,3})?$/.test(value)) {
    return { ok: false, error: "Minimum stock must be a number in kg with up to 3 decimals." };
  }
  if (typeof pigmentId !== "string" || pigmentId.length > 64) return { ok: false, error: "Unknown pigment." };
  try {
    await prisma.pigmentStock.update({
      where: { id: pigmentId },
      data: { minStockKg: value === "" ? null : new Prisma.Decimal(value) },
    });
  } catch (err) {
    console.error("setMinStock failed", err);
    return { ok: false, error: "The minimum stock level could not be saved." };
  }
  revalidatePath("/stocks-consumption");
  return { ok: true };
}

export type SaveStockResult =
  | { ok: true; count: number }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * ADD STOCK — each filled row adds a stock entry to its pigment, creating the
 * pigment the first time its name is used. Quantities are stored as entered
 * and in kg. A new pigment gets an automatic swatch colour from its name.
 */
export async function saveStock(raw: unknown): Promise<SaveStockResult> {
  const parsed = stockInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Please correct the highlighted fields.", fieldErrors };
  }
  const { rows } = parsed.data;
  // Entries are dated the day they are added.
  const today = new Date(`${format(new Date(), "yyyy-MM-dd")}T00:00:00.000Z`);
  const filled = rows.filter((r) => r.name.trim() && r.quantity.trim());

  try {
    await prisma.$transaction(async (tx) => {
      for (const r of filled) {
        const name = cleanName(r.name);
        const key = nameKey(r.name);
        const quantity = Number(r.quantity);
        const pigment = await tx.pigmentStock.upsert({
          where: { nameKey: key },
          update: {},
          create: { name, nameKey: key, color: defaultSwatch(name) },
          select: { id: true, _count: { select: { entries: true } } },
        });
        await tx.pigmentStockEntry.create({
          data: {
            pigmentId: pigment.id,
            // The first quantity a pigment ever gets is its initial stock.
            kind: pigment._count.entries === 0 ? "INITIAL" : "ADDITION",
            date: today,
            unit: r.unit,
            quantity: new Prisma.Decimal(r.quantity.trim()),
            quantityKg: new Prisma.Decimal(round(toKg(quantity, r.unit), 6)),
          },
        });
      }
    });
  } catch (err) {
    console.error("saveStock failed", err);
    return { ok: false, error: "The stock could not be saved. Please try again." };
  }

  revalidatePath("/stocks-consumption");
  return { ok: true, count: filled.length };
}

export type AdjustStockResult = { ok: true; newRemainingHint: string } | { ok: false; error: string };

/**
 * ADJUST STOCK — adds to or removes from one pigment's stock, with an optional
 * note. "Add" is recorded as an ADDITION, "Remove" as a negative ADJUSTMENT.
 * A new entry is written each time; nothing existing is overwritten, so the
 * transaction history (and every consumption record) stays intact.
 */
export async function adjustStock(input: {
  pigmentId: string;
  direction: "add" | "remove";
  quantity: string;
  unit: "KG" | "GM";
  note: string;
}): Promise<AdjustStockResult> {
  const qty = String(input?.quantity ?? "").trim();
  if (!/^\d+(\.\d{1,3})?$/.test(qty) || Number(qty) <= 0) {
    return { ok: false, error: "Enter a quantity greater than 0, with up to 3 decimals." };
  }
  if (input.unit !== "KG" && input.unit !== "GM") return { ok: false, error: "Select a unit." };
  if (input.direction !== "add" && input.direction !== "remove") return { ok: false, error: "Choose Add or Remove." };
  if (typeof input.pigmentId !== "string" || input.pigmentId.length > 64) return { ok: false, error: "Unknown pigment." };
  const note = String(input.note ?? "").trim().slice(0, 200) || null;
  const sign = input.direction === "remove" ? -1 : 1;

  try {
    const pigment = await prisma.pigmentStock.findUnique({ where: { id: input.pigmentId }, select: { name: true } });
    if (!pigment) return { ok: false, error: "Unknown pigment." };
    await prisma.pigmentStockEntry.create({
      data: {
        pigmentId: input.pigmentId,
        kind: sign > 0 ? "ADDITION" : "ADJUSTMENT",
        note,
        date: new Date(`${format(new Date(), "yyyy-MM-dd")}T00:00:00.000Z`),
        unit: input.unit,
        quantity: new Prisma.Decimal(sign * Number(qty)),
        quantityKg: new Prisma.Decimal(round(sign * toKg(Number(qty), input.unit), 6)),
      },
    });
    revalidatePath("/stocks-consumption");
    revalidatePath("/dashboard");
    return { ok: true, newRemainingHint: `${sign > 0 ? "Added" : "Removed"} ${qty} ${input.unit === "GM" ? "gm" : "kg"} ${sign > 0 ? "to" : "from"} ${pigment.name}` };
  } catch (err) {
    console.error("adjustStock failed", err);
    return { ok: false, error: "The stock could not be updated. Please try again." };
  }
}
