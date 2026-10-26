import { z } from "zod";
import { MAX_CYCLE_CHANGES, MAX_REGULAR_MIXERS, MIXER_SLOTS, ROYMIX_INDEX } from "@/lib/production/constants";
import { isPercentCategory, resinKg } from "@/lib/production/materials";

// What the Daily Production form submits. Shared by the client form (React
// Hook Form resolver) and the save action, which parses it again.
//
// The form always carries every mixer slot (MAX_REGULAR_MIXERS regular ones,
// then the Roymix slot) so changing "Number of Mixers Used" or "Roymix Used"
// back and forth does not lose what was typed. The shapes below therefore
// accept anything string-like, and the business rules run in superRefine for
// the active slots only (activeMixerSlots); the rest are ignored and never saved.

const QTY_RE = /^\d+(\.\d{1,3})?$/;
const INT_RE = /^\d+$/;

const pigmentRow = z.object({
  name: z.string(),
  unit: z.enum(["KG", "GM"]),
  quantity: z.string(),
});

const cycleChange = z.object({
  fromCycle: z.string(),
  toCycle: z.string(),
  pigments: z.array(pigmentRow),
});

// One Materials Consumption entry. Which fields apply depends on the category
// (lib/production/materials): `name` is the custom material name for OTHER,
// `itemName` the entry's own name (Grit Name, Resin Name, …); `percent` is used
// by Catalyst / Cobalt / Silane, whose quantity is calculated, not entered.
const materialRow = z.object({
  category: z.enum(["GRIT", "POWDER", "RESIN", "CATALYST", "COBALT", "SILANE", "OTHER"]),
  name: z.string(),
  size: z.string(),
  itemName: z.string(),
  color: z.string(),
  percent: z.string(),
  unit: z.enum(["KG", "GM"]),
  quantity: z.string(),
});

const mixer = z.object({
  pigments: z.array(pigmentRow),
  cycleTimeChanged: z.enum(["NO", "YES"]),
  changeCount: z.string(),
  changes: z.array(cycleChange),
  materials: z.array(materialRow),
});

const requiredText = (label: string) => z.string().trim().min(1, `${label} is required`).max(120);

export const productionInputSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
    serialNo: z
      .string()
      .trim()
      .regex(INT_RE, "S.No. must be a whole number")
      .refine((v) => Number(v) > 0 && Number(v) <= 2_147_483_647, "S.No. must be greater than 0"),
    batchNumber: requiredText("Batch Number"),
    locNumber: requiredText("LOC Number"),
    designName: requiredText("Production/Design Name"),
    totalCycles: z
      .string()
      .trim()
      .regex(INT_RE, "Enter a whole number of cycles")
      .refine((v) => Number(v) >= 1 && Number(v) <= 10_000, "Cycles must be between 1 and 10,000"),
    mixersUsed: z
      .string()
      .trim()
      .min(1, "Number of Mixers Used is required")
      .regex(INT_RE, "Enter a whole number")
      .refine((v) => Number(v) <= MAX_REGULAR_MIXERS, `Enter a number from 0 to ${MAX_REGULAR_MIXERS}`),
    roymixUsed: z.enum(["NO", "YES"]),
    mixers: z.array(mixer).length(MIXER_SLOTS),
  })
  .superRefine((v, ctx) => {
    const totalCycles = INT_RE.test(v.totalCycles.trim()) ? Number(v.totalCycles) : null;
    const slots = activeMixerSlots(v.mixersUsed, v.roymixUsed);
    if (slots.length === 0 && INT_RE.test(v.mixersUsed.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter at least 1 mixer, or set Roymix Used to Yes", path: ["mixersUsed"] });
    }

    slots.forEach((mi) => {
      const m = v.mixers[mi];
      const at = (...path: (string | number)[]) => ["mixers", mi, ...path];
      const issue = (message: string, ...path: (string | number)[]) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: at(...path) });

      const checkPigments = (rows: z.infer<typeof pigmentRow>[], base: (string | number)[], required: boolean) => {
        let filled = 0;
        rows.forEach((r, ri) => {
          const name = r.name.trim();
          const qty = r.quantity.trim();
          if (!name && !qty) return; // an untouched row is ignored
          filled++;
          if (!name) issue("Pigment/Color is required", ...base, ri, "name");
          if (name.length > 120) issue("Name is too long", ...base, ri, "name");
          checkQty(qty, [...base, ri, "quantity"]);
        });
        if (required && filled === 0) issue("Enter at least one pigment/color", ...base);
      };

      const checkQty = (qty: string, path: (string | number)[]) => {
        if (!qty) issue("Quantity is required", ...path);
        else if (!QTY_RE.test(qty)) issue("Up to 3 decimals", ...path);
        else if (Number(qty) <= 0) issue("Must be greater than 0", ...path);
      };

      checkPigments(m.pigments, ["pigments"], false);

      if (m.cycleTimeChanged === "YES") {
        const count = m.changeCount.trim();
        if (!INT_RE.test(count) || Number(count) < 1) {
          issue("Enter how many times it changed", "changeCount");
        } else if (Number(count) > MAX_CYCLE_CHANGES) {
          issue(`At most ${MAX_CYCLE_CHANGES}`, "changeCount");
        } else if (totalCycles !== null && Number(count) > totalCycles) {
          issue("Cannot exceed the total number of cycles", "changeCount");
        } else if (m.changes.length !== Number(count)) {
          issue("Change entries do not match the count", "changeCount");
        }

        let prevTo = 0;
        m.changes.forEach((c, ci) => {
          const from = c.fromCycle.trim();
          const to = c.toCycle.trim();
          const fromOk = INT_RE.test(from) && Number(from) >= 1;
          const toOk = INT_RE.test(to) && Number(to) >= 1;
          if (!fromOk) issue("Enter a cycle number", "changes", ci, "fromCycle");
          if (!toOk) issue("Enter a cycle number", "changes", ci, "toCycle");
          if (fromOk && toOk) {
            const f = Number(from);
            const t = Number(to);
            if (f > t) issue("To must be ≥ From", "changes", ci, "toCycle");
            else if (totalCycles !== null && t > totalCycles) issue(`Max is cycle ${totalCycles}`, "changes", ci, "toCycle");
            if (f <= prevTo) issue(`Must start after cycle ${prevTo}`, "changes", ci, "fromCycle");
            prevTo = Math.max(prevTo, t);
          }
          checkPigments(c.pigments, ["changes", ci, "pigments"], true);
        });
      }

      const resin = resinKg(m.materials);
      m.materials.forEach((r, ri) => {
        if (!materialEntryUsed(r)) return; // an untouched entry is ignored
        for (const field of ["name", "size", "itemName", "color"] as const) {
          if (r[field].trim().length > 120) issue("Too long", "materials", ri, field);
        }
        if (r.category === "OTHER" && !r.name.trim()) issue("Material name is required", "materials", ri, "name");
        if (isPercentCategory(r.category)) {
          const p = r.percent.trim();
          if (!p) issue("Percentage is required", "materials", ri, "percent");
          else if (!QTY_RE.test(p)) issue("Up to 3 decimals", "materials", ri, "percent");
          else if (Number(p) <= 0 || Number(p) > 100) issue("Between 0 and 100", "materials", ri, "percent");
          else if (resin <= 0) issue("Enter the Resin quantity first", "materials", ri, "percent");
        } else {
          checkQty(r.quantity.trim(), ["materials", ri, "quantity"]);
        }
      });
    });
  });

export type ProductionInput = z.infer<typeof productionInputSchema>;
export type MixerInput = ProductionInput["mixers"][number];
export type PigmentRowInput = MixerInput["pigments"][number];
export type CycleChangeInput = MixerInput["changes"][number];
export type MaterialRowInput = MixerInput["materials"][number];

/** The form slots that are in use: Mixer 1 … Mixer N, then the Roymix slot
 *  when Roymix Used is Yes. An invalid N counts as 0. */
export function activeMixerSlots(mixersUsed: string, roymixUsed: string): number[] {
  const raw = mixersUsed.trim();
  const n = /^\d+$/.test(raw) ? Math.min(Number(raw), MAX_REGULAR_MIXERS) : 0;
  const slots = Array.from({ length: n }, (_, i) => i);
  if (roymixUsed === "YES") slots.push(ROYMIX_INDEX);
  return slots;
}

/** Whether a Materials Consumption entry has anything in it. Untouched entries
 *  (the blank row each material starts with) are neither validated nor saved. */
export function materialEntryUsed(r: MaterialRowInput): boolean {
  return [r.quantity, r.percent, r.size, r.itemName, r.color, r.category === "OTHER" ? r.name : ""].some((v) => v.trim() !== "");
}
