// Low Stock Alerts — pigments/colours only (materials have no stock).
//
//   Out of Stock   remaining ≤ 0
//   Low Stock      a minimum is set and remaining ≤ minimum
//   In Stock       a minimum is set and remaining is above it
//   No Minimum     no minimum set and remaining > 0

export type StockStatus = "out" | "low" | "ok" | "unset";

export function stockStatus(remainingKg: number, minStockKg: number | null): StockStatus {
  if (remainingKg <= 0) return "out";
  if (minStockKg === null) return "unset";
  return remainingKg <= minStockKg ? "low" : "ok";
}

/** Sort order for the alerts table: the most urgent first. */
export const STATUS_ORDER: Record<StockStatus, number> = { out: 0, low: 1, unset: 2, ok: 3 };
