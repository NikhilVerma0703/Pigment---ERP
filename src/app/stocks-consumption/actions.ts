"use server";

import { Prisma } from "@prisma/client";
import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { round, toKg } from "@/lib/formula/calc";
import { defaultSwatch } from "@/lib/stock/consumption";
import { stockInputSchema } from "@/lib/stock/schema";
import { cleanName, nameKey } from "@/lib/utils";

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
          select: { id: true },
        });
        await tx.pigmentStockEntry.create({
          data: {
            pigmentId: pigment.id,
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
