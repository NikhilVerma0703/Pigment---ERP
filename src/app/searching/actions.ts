"use server";

import { getFormulaDetail, getProductionDetail } from "@/lib/search/queries";
import type { DetailRef, FormulaDetail, ProductionDetail } from "@/lib/search/types";

export type DetailResult =
  | { type: "formula"; detail: FormulaDetail }
  | { type: "production"; detail: ProductionDetail }
  | { type: "missing" };

/** The complete saved record behind a search result, for the detail view. */
export async function fetchDetail(ref: DetailRef): Promise<DetailResult> {
  if (typeof ref?.id !== "string" || ref.id.length > 64) return { type: "missing" };
  if (ref.type === "formula") {
    const detail = await getFormulaDetail(ref.id);
    return detail ? { type: "formula", detail } : { type: "missing" };
  }
  if (ref.type === "production") {
    const detail = await getProductionDetail(ref.id);
    return detail ? { type: "production", detail } : { type: "missing" };
  }
  return { type: "missing" };
}
