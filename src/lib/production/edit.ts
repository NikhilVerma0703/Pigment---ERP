import "server-only";
import { prisma } from "@/lib/prisma";
import { MIXER_SLOTS, ROYMIX_INDEX } from "@/lib/production/constants";
import { emptyMaterial, emptyMixer, emptyPigment } from "@/lib/production/defaults";
import { isPercentCategory, MATERIAL_SPECS } from "@/lib/production/materials";
import type { MaterialRowInput, MixerInput, PigmentRowInput, ProductionInput } from "@/lib/production/schema";

/** A decimal as the form expects it: "2.5", "500" (no trailing zeros). */
const str = (d: { toString(): string }) => String(Number(d.toString()));

type QtyRow = { name: string; unit: "KG" | "GM"; quantity: { toString(): string } };
const pigmentRows = (rows: QtyRow[]): PigmentRowInput[] =>
  rows.length ? rows.map((p) => ({ name: p.name, unit: p.unit, quantity: str(p.quantity) })) : [emptyPigment()];

/** A saved production record as Daily Production form values, for Edit. Each
 *  saved mixer goes back to its slot (Mixer N → slot N-1, Roymix → its own). */
export async function getProductionForEdit(
  id: string,
): Promise<{ id: string; serialNo: number; batchNumber: string; values: ProductionInput } | null> {
  if (!id || id.length > 64) return null;
  const qty = { select: { name: true, unit: true, quantity: true }, orderBy: { lineNo: "asc" as const } };
  const r = await prisma.productionRecord.findUnique({
    where: { id },
    select: {
      id: true,
      date: true,
      serialNo: true,
      batchNumber: true,
      locNumber: true,
      designName: true,
      totalCycles: true,
      mixersUsed: true,
      roymixUsed: true,
      mixers: {
        select: {
          kind: true,
          position: true,
          cycleTimeChanged: true,
          pigments: { where: { cycleChangeId: null }, ...qty },
          cycleChanges: { orderBy: { seq: "asc" }, select: { fromCycle: true, toCycle: true, pigments: qty } },
          materials: {
            orderBy: { lineNo: "asc" },
            select: { category: true, name: true, size: true, itemName: true, color: true, percent: true, unit: true, quantity: true },
          },
        },
      },
    },
  });
  if (!r) return null;

  const mixers: MixerInput[] = Array.from({ length: MIXER_SLOTS }, emptyMixer);
  for (const m of r.mixers) {
    const slot = m.kind === "ROYMIX" ? ROYMIX_INDEX : m.position - 1;
    if (slot < 0 || slot >= MIXER_SLOTS) continue;

    const materials: MaterialRowInput[] = m.materials.map((x) => ({
      category: x.category,
      name: x.category === "OTHER" ? x.name : "",
      size: x.size ?? "",
      itemName: x.itemName ?? "",
      color: x.color ?? "",
      percent: x.percent === null ? "" : str(x.percent),
      unit: x.unit,
      // Percentage entries are recalculated from the resin, not entered.
      quantity: isPercentCategory(x.category) ? "" : str(x.quantity),
    }));
    // Keep a blank entry for any standard material this mixer did not use.
    for (const spec of MATERIAL_SPECS) {
      if (!materials.some((x) => x.category === spec.category)) materials.push(emptyMaterial(spec.category));
    }

    const changed = m.cycleTimeChanged && m.cycleChanges.length > 0;
    mixers[slot] = {
      pigments: pigmentRows(m.pigments),
      cycleTimeChanged: changed ? "YES" : "NO",
      changeCount: changed ? String(m.cycleChanges.length) : "",
      changes: changed
        ? m.cycleChanges.map((c) => ({ fromCycle: String(c.fromCycle), toCycle: String(c.toCycle), pigments: pigmentRows(c.pigments) }))
        : [],
      materials,
    };
  }

  return {
    id: r.id,
    serialNo: r.serialNo,
    batchNumber: r.batchNumber,
    values: {
      date: r.date.toISOString().slice(0, 10),
      serialNo: String(r.serialNo),
      batchNumber: r.batchNumber,
      locNumber: r.locNumber,
      designName: r.designName,
      totalCycles: String(r.totalCycles),
      mixersUsed: String(r.mixersUsed),
      roymixUsed: r.roymixUsed ? "YES" : "NO",
      mixers,
    },
  };
}
