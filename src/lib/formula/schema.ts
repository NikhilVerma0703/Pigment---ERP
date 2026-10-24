import { z } from "zod";

// What the Formula Creation form submits. Shared by the client form (React
// Hook Form resolver) and the server action, which parses it again.

const decimal3 = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((v) => /^\d+(\.\d{1,3})?$/.test(v), `${label} must be a number with up to 3 decimals`)
    .refine((v) => Number(v) > 0, `${label} must be greater than 0`);

export const formulaItemSchema = z.object({
  name: z.string().trim().min(1, "Material/Color name is required").max(120),
  unit: z.enum(["KG", "GM"]),
  quantity: decimal3("Quantity"),
});

export const formulaInputSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
  serialNo: z
    .string()
    .trim()
    .regex(/^\d+$/, "S.No. must be a whole number")
    .refine((v) => Number(v) > 0 && Number(v) <= 2_147_483_647, "S.No. must be greater than 0"),
  formulaType: z.enum(["LIQUID_VEIN", "DRY_VEIN_PIGMENT", "OTHERS"], {
    errorMap: () => ({ message: "Select a formula type" }),
  }),
  // Any letters, numbers, spaces or special characters (SW, #SW123, 5738).
  name: z.string().trim().min(1, "Formula name is required").max(120),
  mixingHours: z
    .string()
    .trim()
    .regex(/^\d*$/, "Hours must be a whole number")
    .refine((v) => v === "" || Number(v) <= 999, "Hours must be 999 or less"),
  mixingMinutes: z
    .string()
    .trim()
    .regex(/^\d*$/, "Minutes must be a whole number")
    .refine((v) => v === "" || Number(v) <= 59, "Minutes must be 0–59"),
  items: z.array(formulaItemSchema).min(1, "Add at least one material/color"),
  totalQuantityRequired: decimal3("Total Quantity Required"),
});

export type FormulaInput = z.infer<typeof formulaInputSchema>;
export type FormulaItemInput = z.infer<typeof formulaItemSchema>;
