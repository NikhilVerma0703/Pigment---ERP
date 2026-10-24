import { z } from "zod";
import { MAX_CYCLE_CHANGES, MAX_MIXERS } from "@/lib/production/constants";

// What the Daily Production form submits. Shared by the client form (React
// Hook Form resolver) and the save action, which parses it again.
//
// The form always carries all three mixers so switching "Number of Mixers
// Used" from 3 to 2 and back does not lose what was typed. The shapes below
// therefore accept anything string-like, and the business rules run in
// superRefine for the first `mixersUsed` mixers only; the rest are ignored
// and never saved.

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

const materialRow = z.object({
  name: z.string(),
  isStandard: z.boolean(),
  unit: z.enum(["KG", "GM"]),
  quantity: z.string(),
});

const mixer = z.object({
  mixer: z.enum(["MIXER_1", "MIXER_2", "ROYMIX"]),
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
      .refine((v) => Number(v) >= 1 && Number(v) <= MAX_MIXERS, `Enter a number from 1 to ${MAX_MIXERS}`),
    mixers: z.array(mixer).length(3),
  })
  .superRefine((v, ctx) => {
    const totalCycles = INT_RE.test(v.totalCycles.trim()) ? Number(v.totalCycles) : null;
    const used = Math.min(Number(v.mixersUsed) || 0, MAX_MIXERS);

    v.mixers.slice(0, used).forEach((m, mi) => {
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

      m.materials.forEach((r, ri) => {
        const name = r.name.trim();
        const qty = r.quantity.trim();
        if (!qty && (r.isStandard || !name)) return; // not used this time
        if (!r.isStandard && !name) issue("Material name is required", "materials", ri, "name");
        if (name.length > 120) issue("Name is too long", "materials", ri, "name");
        checkQty(qty, ["materials", ri, "quantity"]);
      });
    });
  });

export type ProductionInput = z.infer<typeof productionInputSchema>;
export type MixerInput = ProductionInput["mixers"][number];
export type PigmentRowInput = MixerInput["pigments"][number];
export type CycleChangeInput = MixerInput["changes"][number];
export type MaterialRowInput = MixerInput["materials"][number];
