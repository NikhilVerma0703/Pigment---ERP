import "server-only";
import ExcelJS from "exceljs";
import type { Filters, SearchTab } from "@/lib/search/filters";
import { searchFormulas, searchMaterials, searchPigments, searchProduction } from "@/lib/search/queries";

// Excel workbooks for Searching and for Reports & Downloads. Each writer runs
// the same search as the screen with the given filters and adds detailed
// sheets: every quantity in kg alongside the value as entered. Writers return
// how many records they found, so a caller can refuse an empty download.

interface Col {
  header: string;
  key: string;
  width?: number;
  /** Excel number format, e.g. "0.000". */
  fmt?: string;
}

const KG = "#,##0.000";
const KG6 = "#,##0.000000";
const unitLabel = (u: string) => (u === "GM" ? "gm" : "kg");

export function newWorkbook(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Pigment ERP";
  return wb;
}

export function addSheet(wb: ExcelJS.Workbook, name: string, cols: Col[], rows: Record<string, unknown>[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width ?? Math.max(12, c.header.length + 2) }));
  rows.forEach((r) => ws.addRow(r));
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F4C5C" } };
  header.alignment = { vertical: "middle" };
  cols.forEach((c, i) => {
    if (c.fmt) ws.getColumn(i + 1).numFmt = c.fmt;
  });
  if (rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  else ws.addRow(["No records match the filters."]);
}

export function addInfoSheet(wb: ExcelJS.Workbook, title: string, info: Record<string, string>) {
  const ws = wb.addWorksheet("Filters");
  ws.columns = [{ width: 22 }, { width: 40 }];
  ws.addRow([title]).font = { bold: true, size: 13 };
  ws.addRow(["Exported", new Date().toLocaleString("en-IN")]);
  ws.addRow([]);
  const entries = Object.entries(info);
  if (!entries.length) ws.addRow(["Filters", "None (all records)"]);
  for (const [k, v] of entries) ws.addRow([k, v]);
}

// ---- Formulas ----------------------------------------------------------------

export async function writeFormulaSheets(wb: ExcelJS.Workbook, f: Filters): Promise<number> {
  const formulas = await searchFormulas(f);
  addSheet(
    wb,
    "Formulas",
    [
      { header: "S.No.", key: "serialNo", width: 8 },
      { header: "Date", key: "date" },
      { header: "Formula Name", key: "name", width: 20 },
      { header: "Formula Type", key: "type", width: 20 },
      { header: "Mixing Time", key: "mixing" },
      { header: "Ingredients", key: "count" },
      { header: "Total Quantity Used (kg)", key: "used", fmt: KG },
      { header: "Total Quantity Required (kg)", key: "required", fmt: KG },
      { header: "Consumption Rate", key: "rate", fmt: "0.000" },
    ],
    formulas.map((x) => ({
      serialNo: x.serialNo,
      date: x.date,
      name: x.name,
      type: x.typeLabel,
      mixing: `${x.mixingHours}h ${x.mixingMinutes}m`,
      count: x.items.length,
      used: x.totalUsedKg,
      required: x.requiredKg,
      rate: x.rate,
    })),
  );
  addSheet(
    wb,
    "Ingredients",
    [
      { header: "Formula S.No.", key: "serialNo" },
      { header: "Date", key: "date" },
      { header: "Formula Name", key: "formula", width: 20 },
      { header: "Formula Type", key: "type", width: 20 },
      { header: "Row", key: "line", width: 6 },
      { header: "Material/Color", key: "name", width: 22 },
      { header: "Is Formula", key: "isFormula" },
      { header: "Unit", key: "unit", width: 8 },
      { header: "Quantity", key: "qty", fmt: KG },
      { header: "Consumption Rate", key: "rate", fmt: "0.000" },
      { header: "Required Quantity", key: "req", fmt: KG },
      { header: "Required (kg)", key: "reqKg", fmt: KG6 },
    ],
    formulas.flatMap((x) =>
      x.items.map((i) => ({
        serialNo: x.serialNo,
        date: x.date,
        formula: x.name,
        type: x.typeLabel,
        line: i.lineNo,
        name: i.name,
        isFormula: i.isFormula ? "Yes" : "No",
        unit: unitLabel(i.unit),
        qty: i.quantity,
        rate: x.rate,
        req: i.requiredQuantity,
        reqKg: i.unit === "GM" ? i.requiredQuantity / 1000 : i.requiredQuantity,
      })),
    ),
  );
  return formulas.length;
}

// ---- Daily Production ------------------------------------------------------

export async function writeProductionSheets(wb: ExcelJS.Workbook, f: Filters): Promise<number> {
  const records = await searchProduction(f);
  const base = (r: (typeof records)[number]) => ({
    serialNo: r.serialNo,
    date: r.date,
    batch: r.batchNumber,
    loc: r.locNumber,
    design: r.designName,
  });
  const baseCols: Col[] = [
    { header: "S.No.", key: "serialNo", width: 8 },
    { header: "Date", key: "date" },
    { header: "Batch Number", key: "batch", width: 16 },
    { header: "LOC Number", key: "loc", width: 14 },
    { header: "Production/Design Name", key: "design", width: 24 },
  ];
  addSheet(
    wb,
    "Records",
    [
      ...baseCols,
      { header: "Total Cycles", key: "cycles" },
      { header: "Mixers Used", key: "mixers" },
      { header: "Pigment Consumed (kg)", key: "pig", fmt: KG },
      { header: "Materials Consumed (kg)", key: "mat", fmt: KG },
    ],
    records.map((r) => ({ ...base(r), cycles: r.totalCycles, mixers: r.mixersUsed, pig: r.pigmentKg, mat: r.materialKg })),
  );
  addSheet(
    wb,
    "Pigments",
    [
      ...baseCols,
      { header: "Mixer", key: "mixer" },
      { header: "Section", key: "section", width: 22 },
      { header: "Row", key: "line", width: 6 },
      { header: "Pigment/Color", key: "name", width: 20 },
      { header: "Is Formula", key: "isFormula" },
      { header: "Unit", key: "unit", width: 8 },
      { header: "Qty per Cycle", key: "qty", fmt: KG },
      { header: "Cycles", key: "cycles" },
      { header: "Consumed (kg)", key: "kg", fmt: KG6 },
    ],
    records.flatMap((r) =>
      r.mixers.flatMap((m) => [
        ...m.pigments.map((p) => ({ ...base(r), mixer: m.label, section: "Pigment/Color Details", line: p.lineNo, name: p.name, isFormula: p.isFormula ? "Yes" : "No", unit: unitLabel(p.unit), qty: p.quantity, cycles: p.cycles, kg: p.consumedKg })),
        ...m.changes.flatMap((c) =>
          c.pigments.map((p) => ({ ...base(r), mixer: m.label, section: `Change ${c.seq}: cycles ${c.fromCycle}–${c.toCycle}`, line: p.lineNo, name: p.name, isFormula: p.isFormula ? "Yes" : "No", unit: unitLabel(p.unit), qty: p.quantity, cycles: p.cycles, kg: p.consumedKg })),
        ),
      ]),
    ),
  );
  addSheet(
    wb,
    "Materials",
    [
      ...baseCols,
      { header: "Mixer", key: "mixer" },
      { header: "Row", key: "line", width: 6 },
      { header: "Material", key: "name", width: 18 },
      { header: "Unit", key: "unit", width: 8 },
      { header: "Quantity", key: "qty", fmt: KG },
      { header: "Quantity (kg)", key: "kg", fmt: KG6 },
    ],
    records.flatMap((r) =>
      r.mixers.flatMap((m) => m.materials.map((x) => ({ ...base(r), mixer: m.label, line: x.lineNo, name: x.name, unit: unitLabel(x.unit), qty: x.quantity, kg: x.kg }))),
    ),
  );
  return records.length;
}

// ---- Stock & pigment consumption ---------------------------------------------

export async function writePigmentSheets(wb: ExcelJS.Workbook, f: Filters): Promise<number> {
  const { rows, summary } = await searchPigments(f);
  addSheet(
    wb,
    "Pigment Summary",
    [
      { header: "Pigment/Color", key: "name", width: 20 },
      { header: "On Stock List", key: "tracked" },
      { header: "Total Stock (kg)", key: "stock", fmt: KG },
      { header: "Consumed — all time (kg)", key: "all", fmt: KG },
      { header: "Remaining (kg)", key: "rem", fmt: KG },
      { header: "Consumed — these results (kg)", key: "filtered", fmt: KG },
    ],
    summary.map((s) => ({
      name: s.name,
      tracked: s.tracked ? "Yes" : "No",
      stock: s.tracked ? s.totalStockKg : null,
      all: s.consumedAllKg,
      rem: s.tracked ? s.remainingKg : null,
      filtered: s.consumedFilteredKg,
    })),
  );
  addSheet(
    wb,
    "Pigment Transactions",
    [
      { header: "Date", key: "date" },
      { header: "Pigment/Color", key: "pigment", width: 18 },
      { header: "Type", key: "type", width: 14 },
      { header: "Reference", key: "reference", width: 30 },
      { header: "Batch Number", key: "batch", width: 14 },
      { header: "LOC Number", key: "loc", width: 12 },
      { header: "Design", key: "design", width: 18 },
      { header: "Mixer", key: "mixer" },
      { header: "Cycle Range", key: "range" },
      { header: "Cycles", key: "cycles" },
      { header: "Quantity as Entered", key: "qty", fmt: KG },
      { header: "Unit", key: "unit", width: 8 },
      { header: "Stock In (kg)", key: "in", fmt: KG6 },
      { header: "Consumed (kg)", key: "out", fmt: KG6 },
      { header: "Balance After (kg)", key: "balance", fmt: KG6 },
    ],
    rows.map((t) => ({
      date: t.date,
      pigment: t.pigment,
      type: t.kind === "in" ? "Stock added" : t.kind === "formula" ? "Formula" : "Daily Production",
      reference: t.reference,
      batch: t.batchNumber,
      loc: t.locNumber,
      design: t.designName,
      mixer: t.mixer,
      range: t.range,
      cycles: t.cycles,
      qty: t.quantity,
      unit: `${unitLabel(t.unit)}${t.kind === "production" ? " per cycle" : ""}`,
      in: t.inKg || null,
      out: t.outKg || null,
      balance: t.balanceKg,
    })),
  );
  return rows.length;
}

// ---- Materials — consumption only ------------------------------------------

export async function writeMaterialSheets(wb: ExcelJS.Workbook, f: Filters): Promise<number> {
  const { rows, daily, totals } = await searchMaterials(f);
  addSheet(
    wb,
    "Materials Consumption",
    [
      { header: "Date", key: "date" },
      { header: "Batch Number", key: "batch", width: 14 },
      { header: "LOC Number", key: "loc", width: 12 },
      { header: "Design", key: "design", width: 20 },
      { header: "Mixer", key: "mixer" },
      { header: "Material", key: "material", width: 18 },
      { header: "Quantity", key: "qty", fmt: KG },
      { header: "Unit", key: "unit", width: 8 },
      { header: "Quantity (kg)", key: "kg", fmt: KG6 },
    ],
    rows.map((r) => ({ date: r.date, batch: r.batchNumber, loc: r.locNumber, design: r.designName, mixer: r.mixer, material: r.material, qty: r.quantity, unit: unitLabel(r.unit), kg: r.kg })),
  );
  addSheet(
    wb,
    "Materials Daily",
    [
      { header: "Date", key: "date" },
      { header: "Material", key: "material", width: 18 },
      { header: "Consumed that Day (kg)", key: "kg", fmt: KG },
      { header: "Cumulative (kg)", key: "cum", fmt: KG },
    ],
    daily.map((d) => ({ date: d.date, material: d.material, kg: d.kg, cum: d.cumulativeKg })),
  );
  addSheet(
    wb,
    "Materials Totals",
    [
      { header: "Material", key: "material", width: 18 },
      { header: "Total Consumed (kg)", key: "kg", fmt: KG },
    ],
    totals.map((t) => ({ material: t.material, kg: t.kg })),
  );
  return rows.length;
}

// ---- Searching ---------------------------------------------------------------

const SEARCH_EXPORTS: Record<SearchTab, { title: string; file: string; write: (wb: ExcelJS.Workbook, f: Filters) => Promise<number> }> = {
  formulas: { title: "Formula Search", file: "formula-search", write: writeFormulaSheets },
  production: { title: "Daily Production Search", file: "production-search", write: writeProductionSheets },
  pigments: { title: "Stock & Pigment Consumption Search", file: "pigment-consumption", write: writePigmentSheets },
  materials: { title: "Materials Consumption Search", file: "materials-consumption", write: writeMaterialSheets },
};

export async function buildSearchWorkbook(tab: SearchTab, f: Filters): Promise<{ buffer: ArrayBuffer; filename: string }> {
  const wb = newWorkbook();
  const spec = SEARCH_EXPORTS[tab];
  await spec.write(wb, f);
  addInfoSheet(wb, spec.title, f);
  const stamp = new Date().toISOString().slice(0, 10);
  return { buffer: await wb.xlsx.writeBuffer(), filename: `${spec.file}-${stamp}.xlsx` };
}
