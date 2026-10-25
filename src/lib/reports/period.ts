import { endOfMonth, format, parse, startOfMonth, subMonths } from "date-fns";

// Periods for Reports & Downloads. Pure and shared: the page, the download
// form and the download route all resolve a period the same way. Dates are
// yyyy-mm-dd calendar dates, compared as strings.

export const REPORT_TABS = [
  { value: "production", label: "Production Summary Reports" },
  { value: "consumption", label: "Consumption & Cost Reports" },
  { value: "downloads", label: "Downloads" },
] as const;
export type ReportTab = (typeof REPORT_TABS)[number]["value"];

export const GROUPS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
] as const;
export type Group = (typeof GROUPS)[number]["value"];

export const DOWNLOAD_TYPES = [
  { value: "formulas", label: "Formula Creation" },
  { value: "production", label: "Production Report" },
  { value: "stock", label: "Stock & Consumption" },
] as const;
export type DownloadType = (typeof DOWNLOAD_TYPES)[number]["value"];

export const PERIOD_KINDS = [
  { value: "today", label: "Today" },
  { value: "custom", label: "Custom Date" },
  { value: "month", label: "Month-wise" },
] as const;
export type PeriodKind = (typeof PERIOD_KINDS)[number]["value"];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const ymd = (d: Date) => format(d, "yyyy-MM-dd");

type Params = Record<string, string | string[] | undefined> | URLSearchParams;
function read(params: Params, key: string): string {
  const v = params instanceof URLSearchParams ? params.get(key) : params[key];
  return (Array.isArray(v) ? v[0] : v ?? "").trim();
}

export function parseReportTab(params: Params): ReportTab {
  const t = read(params, "tab");
  return REPORT_TABS.some((r) => r.value === t) ? (t as ReportTab) : "production";
}

/** The report range from the URL; defaults to this month up to today. */
export function parseReportRange(params: Params, now = new Date()): { from: string; to: string; group: Group } {
  let from = read(params, "from");
  let to = read(params, "to");
  if (!DATE_RE.test(from)) from = ymd(startOfMonth(now));
  if (!DATE_RE.test(to)) to = ymd(now);
  if (from > to) [from, to] = [to, from];
  const g = read(params, "group");
  const group = GROUPS.some((x) => x.value === g) ? (g as Group) : "daily";
  return { from, to, group };
}

/** The last `count` months, newest first, e.g. { value: "2026-10", label: "October 2026" }. */
export function monthOptions(count = 24, now = new Date()): { value: string; label: string }[] {
  return Array.from({ length: count }, (_, i) => {
    const d = subMonths(startOfMonth(now), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") };
  });
}

export type ResolvedPeriod = { ok: true; from: string; to: string; label: string } | { ok: false; error: string };

/** Turns the Downloads form's period choice into a date range, or explains what is wrong. */
export function resolvePeriod(
  input: { period: string; from?: string; to?: string; month?: string },
  now = new Date(),
): ResolvedPeriod {
  const today = ymd(now);
  switch (input.period) {
    case "today":
      return { ok: true, from: today, to: today, label: `Today (${format(now, "dd MMM yyyy")})` };
    case "custom": {
      const from = (input.from ?? "").trim();
      const to = (input.to ?? "").trim() || from;
      if (!DATE_RE.test(from)) return { ok: false, error: "Select a From date." };
      if (!DATE_RE.test(to)) return { ok: false, error: "Select a valid To date." };
      if (from > to) return { ok: false, error: "From date must be on or before To date." };
      if (from > today) return { ok: false, error: "The selected date is in the future." };
      const label = (d: string) => format(parse(d, "yyyy-MM-dd", now), "dd MMM yyyy");
      return { ok: true, from, to, label: from === to ? label(from) : `${label(from)} – ${label(to)}` };
    }
    case "month": {
      const month = (input.month ?? "").trim();
      if (!MONTH_RE.test(month)) return { ok: false, error: "Select a month." };
      const start = parse(`${month}-01`, "yyyy-MM-dd", now);
      return { ok: true, from: ymd(start), to: ymd(endOfMonth(start)), label: format(start, "MMMM yyyy") };
    }
    default:
      return { ok: false, error: "Select a period." };
  }
}
