"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { DataTable, type Column } from "@/components/search/DataTable";
import { RecordDetailModal } from "@/components/search/RecordDetail";
import { formatQty } from "@/lib/formula/calc";
import type { DetailRef, MaterialDaily, MaterialRow, PigmentSummary, PigmentTxn } from "@/lib/search/types";
import { cn } from "@/lib/utils";

const day = (d: string) => format(parseISO(d), "dd MMM yyyy");
const kg = (v: number) => `${formatQty(v)} kg`;
const unit = (u: string) => (u === "GM" ? "gm" : "kg");

function useDetail() {
  const [target, setTarget] = useState<DetailRef | null>(null);
  const close = useCallback(() => setTarget(null), []);
  return { target, open: setTarget, modal: <RecordDetailModal target={target} onClose={close} /> };
}

// ---- 1. Formulas -----------------------------------------------------------

export interface FormulaResultRow {
  id: string;
  serialNo: number;
  date: string;
  name: string;
  typeLabel: string;
  mixing: string;
  ingredients: string;
  itemCount: number;
  totalUsedKg: number;
  requiredKg: number;
  rate: number;
}

export function FormulaResults({ rows }: { rows: FormulaResultRow[] }) {
  const { open, modal } = useDetail();
  const columns: Column<FormulaResultRow>[] = [
    { key: "serialNo", header: "S.No.", render: (r) => r.serialNo, sort: (r) => r.serialNo },
    { key: "date", header: "Date", render: (r) => day(r.date), sort: (r) => r.date, className: "whitespace-nowrap" },
    { key: "name", header: "Formula Name", render: (r) => <span className="font-semibold text-brand-800">{r.name}</span>, sort: (r) => r.name.toLowerCase() },
    { key: "type", header: "Formula Type", render: (r) => r.typeLabel, sort: (r) => r.typeLabel },
    { key: "ingredients", header: "Materials / Colors Used", render: (r) => <span className="text-gray-700">{r.ingredients}</span>, className: "min-w-[260px]" },
    { key: "mixing", header: "Mixing Time", render: (r) => r.mixing, className: "whitespace-nowrap" },
    { key: "used", header: "Total Used", align: "right", render: (r) => kg(r.totalUsedKg), sort: (r) => r.totalUsedKg },
    { key: "required", header: "Required", align: "right", render: (r) => kg(r.requiredKg), sort: (r) => r.requiredKg },
    { key: "rate", header: "Rate", align: "right", render: (r) => formatQty(r.rate), sort: (r) => r.rate },
  ];
  return (
    <>
      <DataTable rows={rows} columns={columns} onRowClick={(r) => open({ type: "formula", id: r.id })} emptyText="No formulas match these filters." />
      {modal}
    </>
  );
}

// ---- 2. Daily Production ----------------------------------------------------

export interface ProductionResultRow {
  id: string;
  serialNo: number;
  date: string;
  batchNumber: string;
  locNumber: string;
  designName: string;
  totalCycles: number;
  mixers: string;
  pigments: string;
  pigmentKg: number;
  materialKg: number;
}

export function ProductionResults({ rows }: { rows: ProductionResultRow[] }) {
  const router = useRouter();
  // A result opens its Batch Details Report page; "Back to Search" returns to this search.
  const openReport = (id: string) =>
    router.push(`/searching/batch/${id}?back=${encodeURIComponent(window.location.search.slice(1))}`);
  const columns: Column<ProductionResultRow>[] = [
    { key: "serialNo", header: "S.No.", render: (r) => r.serialNo, sort: (r) => r.serialNo },
    { key: "date", header: "Date", render: (r) => day(r.date), sort: (r) => r.date, className: "whitespace-nowrap" },
    { key: "batch", header: "Batch Number", render: (r) => <span className="font-semibold text-brand-800">{r.batchNumber}</span>, sort: (r) => r.batchNumber.toLowerCase() },
    { key: "loc", header: "LOC Number", render: (r) => r.locNumber, sort: (r) => r.locNumber.toLowerCase() },
    { key: "design", header: "Production/Design", render: (r) => r.designName, sort: (r) => r.designName.toLowerCase() },
    { key: "cycles", header: "Cycles", align: "right", render: (r) => r.totalCycles, sort: (r) => r.totalCycles },
    { key: "mixers", header: "Mixers", render: (r) => r.mixers, className: "whitespace-nowrap" },
    { key: "pigments", header: "Formula/Pigments Used", render: (r) => r.pigments || "—", className: "min-w-[180px]" },
    { key: "pigKg", header: "Pigment Consumed", align: "right", render: (r) => kg(r.pigmentKg), sort: (r) => r.pigmentKg },
    { key: "matKg", header: "Materials Consumed", align: "right", render: (r) => kg(r.materialKg), sort: (r) => r.materialKg },
  ];
  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        onRowClick={(r) => openReport(r.id)}
        emptyText="No production records match these filters."
      />
    </>
  );
}

// ---- 3. Stock & pigment consumption -----------------------------------------

const KIND = {
  in: { label: "Stock in", cls: "bg-emerald-50 text-emerald-700" },
  adjust: { label: "Adjustment", cls: "bg-violet-50 text-violet-700" },
  formula: { label: "Formula produced", cls: "bg-brand-100 text-brand-700" },
  production: { label: "Consumed", cls: "bg-amber-50 text-amber-700" },
} as const;

export function PigmentResults({ rows, summary }: { rows: PigmentTxn[]; summary: PigmentSummary[] }) {
  const { open, modal } = useDetail();
  const columns: Column<PigmentTxn>[] = [
    { key: "date", header: "Date", render: (t) => day(t.date), sort: (t) => t.date, className: "whitespace-nowrap" },
    {
      key: "pigment",
      header: "Pigment/Color",
      render: (t) => (
        <span className="inline-flex items-center gap-2 font-medium text-gray-900">
          <span className="h-3 w-3 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: t.color ?? "#e5e7eb" }} aria-hidden />
          {t.pigment}
        </span>
      ),
      sort: (t) => t.pigment.toLowerCase(),
    },
    {
      key: "kind",
      header: "Type",
      render: (t) => <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", KIND[t.kind].cls)}>{KIND[t.kind].label}</span>,
      sort: (t) => t.kind,
    },
    { key: "reference", header: "Reference", render: (t) => t.reference, className: "min-w-[180px]" },
    { key: "batch", header: "Batch", render: (t) => t.batchNumber || "—", sort: (t) => t.batchNumber },
    { key: "loc", header: "LOC", render: (t) => t.locNumber || "—", sort: (t) => t.locNumber },
    { key: "mixer", header: "Mixer / Cycles", render: (t) => (t.kind === "production" ? `${t.mixer}${t.range ? ` · ${t.range}` : ""}` : "—"), className: "whitespace-nowrap" },
    {
      key: "qty",
      header: "Quantity",
      align: "right",
      render: (t) =>
        t.kind === "production" ? `${formatQty(t.quantity)} ${unit(t.unit)} × ${t.cycles}` : `${formatQty(t.quantity)} ${unit(t.unit)}`,
      className: "whitespace-nowrap",
    },
    { key: "in", header: "Stock In / Adj. (kg)", align: "right", render: (t) =>
        t.inKg > 0 ? <span className="text-emerald-700">+{formatQty(t.inKg)}</span> : t.inKg < 0 ? <span className="text-red-600">−{formatQty(-t.inKg)}</span> : "—", sort: (t) => t.inKg },
    { key: "out", header: "Consumed (kg)", align: "right", render: (t) => (t.outKg ? <span className="text-red-600">−{formatQty(t.outKg)}</span> : "—"), sort: (t) => t.outKg },
    {
      key: "balance",
      header: "Balance (kg)",
      align: "right",
      render: (t) => (t.balanceKg === null ? <span className="text-gray-400">—</span> : <span className={cn("font-semibold", t.balanceKg < 0 && "text-red-600")}>{formatQty(t.balanceKg)}</span>),
      sort: (t) => t.balanceKg,
    },
  ];
  return (
    <div className="space-y-4">
      {summary.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
          {summary.map((s) => (
            <div key={s.name} className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: s.color ?? "#e5e7eb" }} aria-hidden />
                <span className="truncate font-semibold text-gray-900">{s.name}</span>
              </div>
              {s.tracked ? (
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt className="text-gray-500">Total Stock</dt><dd className="text-right tabular-nums">{kg(s.totalStockKg)}</dd>
                  <dt className="text-gray-500">Consumed (all)</dt><dd className="text-right tabular-nums">{kg(s.consumedAllKg)}</dd>
                  <dt className="font-semibold text-gray-700">Remaining</dt>
                  <dd className={cn("text-right font-semibold tabular-nums", s.remainingKg < 0 ? "text-red-600" : "text-gray-900")}>{kg(s.remainingKg)}</dd>
                  <dt className="text-gray-500">In these results</dt><dd className="text-right tabular-nums">{kg(s.consumedFilteredKg)}</dd>
                </dl>
              ) : (
                <p className="mt-2 text-xs text-amber-700">
                  Not on the stock list — consumed {kg(s.consumedFilteredKg)} in these results.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      <DataTable
        rows={rows}
        columns={columns}
        onRowClick={(t) => t.ref && open(t.ref)}
        emptyText="No stock or consumption transactions match these filters."
      />
      {modal}
    </div>
  );
}

// ---- 4. Materials — consumption only --------------------------------------

export function MaterialResults({
  rows,
  daily,
  totals,
}: {
  rows: MaterialRow[];
  daily: MaterialDaily[];
  totals: { material: string; kg: number }[];
}) {
  const { open, modal } = useDetail();
  const columns: Column<MaterialRow>[] = [
    { key: "date", header: "Date", render: (r) => day(r.date), sort: (r) => r.date, className: "whitespace-nowrap" },
    { key: "batch", header: "Batch Number", render: (r) => r.batchNumber, sort: (r) => r.batchNumber.toLowerCase() },
    { key: "loc", header: "LOC Number", render: (r) => r.locNumber, sort: (r) => r.locNumber.toLowerCase() },
    { key: "design", header: "Design", render: (r) => r.designName, sort: (r) => r.designName.toLowerCase() },
    { key: "mixer", header: "Mixer", render: (r) => r.mixer, sort: (r) => r.mixer, className: "whitespace-nowrap" },
    { key: "material", header: "Material", render: (r) => <span className="font-semibold text-gray-900">{r.material}</span>, sort: (r) => r.material.toLowerCase() },
    { key: "detail", header: "Size / Name / Color", render: (r) => <span className="text-gray-600">{r.detail || "—"}</span>, sort: (r) => r.detail },
    { key: "qty", header: "Quantity Used", align: "right", render: (r) => `${formatQty(r.quantity)} ${unit(r.unit)}` },
    { key: "kg", header: "In kg", align: "right", render: (r) => kg(r.kg), sort: (r) => r.kg },
  ];
  const dailyRows = daily.map((d) => ({ ...d, id: `${d.date}|${d.material}` }));
  const dailyColumns: Column<(typeof dailyRows)[number]>[] = [
    { key: "date", header: "Date", render: (d) => day(d.date), sort: (d) => d.date },
    { key: "material", header: "Material", render: (d) => <span className="font-medium">{d.material}</span>, sort: (d) => d.material.toLowerCase() },
    { key: "kg", header: "Consumed that Day", align: "right", render: (d) => kg(d.kg), sort: (d) => d.kg },
    { key: "cum", header: "Cumulative Total", align: "right", render: (d) => <span className="font-semibold">{kg(d.cumulativeKg)}</span>, sort: (d) => d.cumulativeKg },
  ];
  return (
    <div className="space-y-6">
      {totals.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {totals.map((t) => (
            <span key={t.material} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm">
              <span className="text-gray-600">{t.material}</span> <span className="font-semibold tabular-nums text-gray-900">{kg(t.kg)}</span>
            </span>
          ))}
        </div>
      )}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-800">Consumption per Production Record</h3>
        <DataTable rows={rows} columns={columns} onRowClick={(r) => open({ type: "production", id: r.recordId })} emptyText="No material consumption matches these filters." />
      </div>
      {daily.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-800">Daily and Cumulative Totals</h3>
          <DataTable rows={dailyRows} columns={dailyColumns} />
        </div>
      )}
      {modal}
    </div>
  );
}
