import type ExcelJS from "exceljs";
import { DOWNLOAD_TYPES, resolvePeriod, type DownloadType } from "@/lib/reports/period";
import {
  addInfoSheet,
  addSheet,
  newWorkbook,
  writeFormulaSheets,
  writeMaterialSheets,
  writePigmentSheets,
  writeProductionSheets,
} from "@/lib/search/export";
import { stockStatus } from "@/lib/stock/alerts";
import { loadPigmentLedger } from "@/lib/stock/queries";

export const dynamic = "force-dynamic";

const STATUS_LABEL = { out: "Out of Stock", low: "Low Stock", ok: "In Stock", unset: "No Minimum Set" } as const;

/** Stock & Consumption: current stock of every pigment, then the period's
 *  pigment movements and material consumption. Counts only the period's rows. */
async function writeStockReport(wb: ExcelJS.Workbook, range: { from: string; to: string }): Promise<number> {
  const { stockRows } = await loadPigmentLedger();
  addSheet(
    wb,
    "Current Stock",
    [
      { header: "Pigment/Color", key: "name", width: 20 },
      { header: "Total Stock (kg)", key: "total", fmt: "#,##0.000" },
      { header: "Consumed (kg)", key: "consumed", fmt: "#,##0.000" },
      { header: "Remaining (kg)", key: "remaining", fmt: "#,##0.000" },
      { header: "Minimum Stock Level (kg)", key: "min", fmt: "#,##0.000" },
      { header: "Status", key: "status", width: 16 },
    ],
    stockRows.map((s) => ({
      name: s.name,
      total: s.totalKg,
      consumed: s.consumedKg,
      remaining: s.remainingKg,
      min: s.minStockKg,
      status: STATUS_LABEL[stockStatus(s.remainingKg, s.minStockKg)],
    })),
  );
  const pigments = await writePigmentSheets(wb, range);
  const materials = await writeMaterialSheets(wb, range);
  return pigments + materials;
}

const REPORTS: Record<DownloadType, { file: string; write: (wb: ExcelJS.Workbook, r: { from: string; to: string }) => Promise<number>; empty: string }> = {
  formulas: { file: "formula-creation", write: writeFormulaSheets, empty: "No formulas were created" },
  production: { file: "production-report", write: writeProductionSheets, empty: "No Daily Production records were saved" },
  stock: { file: "stock-consumption", write: writeStockReport, empty: "No stock was added or consumed" },
};

const json = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json" } });

/**
 * GET /api/reports/download?type=formulas|production|stock
 *     &period=today|custom|month[&from=&to=][&month=yyyy-mm]
 * → .xlsx, or JSON { error } (400 invalid input, 404 no records in the period).
 */
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const type = p.get("type") ?? "";
  const spec = DOWNLOAD_TYPES.find((t) => t.value === type);
  if (!spec) return json(400, "Select a report type.");

  const period = resolvePeriod({
    period: p.get("period") ?? "",
    from: p.get("from") ?? "",
    to: p.get("to") ?? "",
    month: p.get("month") ?? "",
  });
  if (!period.ok) return json(400, period.error);

  try {
    const report = REPORTS[spec.value];
    const wb = newWorkbook();
    const count = await report.write(wb, { from: period.from, to: period.to });
    if (count === 0) return json(404, `${report.empty} in ${period.label}.`);
    addInfoSheet(wb, spec.label, { Report: spec.label, Period: period.label, From: period.from, To: period.to });
    const suffix = period.from === period.to ? period.from : `${period.from}_to_${period.to}`;
    return new Response(await wb.xlsx.writeBuffer(), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${report.file}_${suffix}.xlsx"`,
        "X-Record-Count": String(count),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("report download failed", err);
    return json(500, "The report could not be created. Please try again.");
  }
}
