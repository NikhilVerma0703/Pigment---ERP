import ExcelJS from "exceljs";
import { format, parseISO } from "date-fns";
import { buildBatchReport, kgText } from "@/lib/reports/batch";
import { getProductionDetail } from "@/lib/search/queries";

export const dynamic = "force-dynamic";

const BRAND = "FF0F4C5C";
const BORDER = { style: "thin" as const, color: { argb: "FFD1D5DB" } };
const box = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };

/** GET /api/batch-report/:id → the Batch Details Report as one .xlsx sheet. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = id.length <= 64 ? await getProductionDetail(id) : null;
  if (!detail) return new Response("Batch not found.", { status: 404 });
  const r = buildBatchReport(detail);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Pigment ERP";
  const ws = wb.addWorksheet("Batch Report", { pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 } });
  const width = Math.max(3 + r.mixers.length + 1, 2 + r.rangeColumns.length, 5);

  const title = ws.addRow([`Batch Details Report — ${r.batchNumber}`]);
  title.font = { bold: true, size: 14, color: { argb: BRAND } };
  ws.mergeCells(title.number, 1, title.number, width);
  ws.addRow([]);

  const header = (cells: string[]) => {
    const row = ws.addRow(cells);
    row.eachCell((c) => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
      c.border = box;
      c.alignment = { vertical: "middle", wrapText: true };
    });
    return row;
  };
  const body = (cells: (string | number)[], rightFrom = Infinity) => {
    const row = ws.addRow(cells);
    row.eachCell({ includeEmpty: true }, (c, col) => {
      c.border = box;
      c.alignment = { vertical: "top", wrapText: true, horizontal: col > rightFrom ? "right" : "left" };
    });
    return row;
  };
  const section = (text: string) => {
    ws.addRow([]);
    const row = ws.addRow([text]);
    row.font = { bold: true, size: 12 };
  };

  // 1. Basic information
  header(["Batch Number", "Date", "LOC Number", "Production / Design Name", "Total Number of Cycles Running"]);
  body([r.batchNumber, format(parseISO(r.date), "dd MMM yyyy"), r.locNumber, r.designName, r.totalCycles]);

  // 2. Materials consumption
  section("Materials Consumption Details");
  header(["S.No.", "Material Name", "Material Size", ...r.mixers, "Total Quantity"]);
  for (const m of r.materialRows) {
    body([m.sno ?? "", m.material, m.size, ...m.perMixer.map(kgText), kgText(m.totalKg)], 3);
  }

  // 3. Pigment details
  section("Pigment Details");
  header(["Mixer", "Original Pigment Details", ...r.rangeColumns.map((c) => `Cycles ${c}`)]);
  for (const p of r.pigmentRows) body([p.mixer, p.original, ...p.ranges]);
  if (r.rangeColumns.length === 0) ws.addRow(["Cycle time was not changed for any mixer."]).font = { italic: true, color: { argb: "FF6B7280" } };

  ws.getColumn(1).width = 16;
  ws.getColumn(2).width = 30;
  for (let c = 3; c <= width; c++) ws.getColumn(c).width = 22;

  return new Response(await wb.xlsx.writeBuffer(), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="batch-report_${r.batchNumber.replace(/[^\w.-]+/g, "_")}_${r.date}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
