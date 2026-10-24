/** Range options for the Consumption Analytics charts, in days. */
export const ANALYTICS_RANGES = [7, 15, 30] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];
export const DEFAULT_ANALYTICS_RANGE: AnalyticsRange = 30;

/** The ?range= search param as a valid range, else the default. */
export function parseAnalyticsRange(value: string | string[] | undefined): AnalyticsRange {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return (ANALYTICS_RANGES as readonly number[]).includes(n) ? (n as AnalyticsRange) : DEFAULT_ANALYTICS_RANGE;
}
