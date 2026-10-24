import { z } from "zod";

// The "Stock" entry form: any number of pigment rows. Untouched rows are
// ignored; a name that is already on the stock list adds to it.

const QTY_RE = /^\d+(\.\d{1,3})?$/;

const stockRow = z.object({
  name: z.string(),
  unit: z.enum(["KG", "GM"]),
  quantity: z.string(),
});

export const stockInputSchema = z
  .object({
    rows: z.array(stockRow),
  })
  .superRefine((v, ctx) => {
    let filled = 0;
    v.rows.forEach((r, i) => {
      const name = r.name.trim();
      const qty = r.quantity.trim();
      if (!name && !qty) return;
      filled++;
      const issue = (message: string, field: string) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ["rows", i, field] });
      if (!name) issue("Pigment/Color name is required", "name");
      else if (name.length > 120) issue("Name is too long", "name");
      if (!qty) issue("Quantity is required", "quantity");
      else if (!QTY_RE.test(qty)) issue("Up to 3 decimals", "quantity");
      else if (Number(qty) <= 0) issue("Must be greater than 0", "quantity");
    });
    if (filled === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter at least one pigment/color", path: ["rows"] });
  });

export type StockInput = z.infer<typeof stockInputSchema>;
export type StockRowInput = StockInput["rows"][number];
