"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { CalendarRange, Loader2 } from "lucide-react";
import { DataTable, type Column } from "@/components/search/DataTable";
import { RecordDetailModal } from "@/components/search/RecordDetail";
import { formatQty } from "@/lib/formula/calc";
import { GROUPS, type Group, type ReportTab } from "@/lib/reports/period";
import type { ConsumptionReport, ConsumptionRow, CycleChangeRow, PeriodRow, ProductionSummary } from "@/lib/reports/queries";
import type { DetailRef } from "@/lib/search/types";

const kg = (v: number) => `${formatQty(v)} kg`;
const day = (d: string) => format(parseISO(d), "dd MMM yyyy");
const th = "whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600";

function useDetail() {
  const [target, setTarget] = useState<DetailRef | null>(null);
  const close = useCallback(() => setTarget(null), []);
  return { open: setTarget, modal: <RecordDetailModal target={target} onClose={close} /> };
}

/** From–To range (and, for production, Daily/Weekly/Monthly) kept in the URL. */
export function ReportRangeFilter({ tab, from, to, group }: { tab: ReportTab; from: string; to: string; group?: Group }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const [g, setG] = useState<Group | undefined>(group);
  const invalid = !f || !t || f > t;

  return (
    <form
      className="card flex flex-wrap items-end gap-4 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (invalid) return;
        const q = new URLSearchParams({ tab, from: f, to: t, ...(g ? { group: g } : {}) });
        startTransition(() => router.push(`/reports?${q}`, { scroll: false }));
      }}
    >
      <div>
        <label className="field-label" htmlFor="r-from">From</label>
        <input id="r-from" type="date" className="field-input" value={f} max={t || undefined} onChange={(e) => setF(e.target.value)} />
      </div>
      <div>
        <label className="field-label" htmlFor="r-to">To</label>
        <input id="r-to" type="date" className="field-input" value={t} min={f || undefined} onChange={(e) => setT(e.target.value)} />
      </div>
      {g && (
        <div>
          <label className="field-label" htmlFor="r-group">Summary By</label>
          <select id="r-group" className="field-input" value={g} onChange={(e) => setG(e.target.value as Group)}>
            {GROUPS.map((x) => (
              <option key={x.value} value={x.value}>{x.label}</option>
            ))}
          </select>
        </div>
      )}
      <button type="submit" className="btn-primary" disabled={pending || invalid}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarRange className="h-4 w-4" />} Show Report
      </button>
      {f > t && <p className="field-error w-full">From date must be on or before To date.</p>}
    </form>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-pacific-dark">{value}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">{text}</p>;
}

// ---- 1. Production summary ---------------------------------------------------

export function ProductionSummaryView({ summary, rangeLabel }: { summary: ProductionSummary; rangeLabel: string }) {
  const { open, modal } = useDetail();
  const { periods, totals, mixers, changes } = summary;
  // A cycles column for each mixer used in the range.
  const mixerLabels = mixers.map((m) => m.label);

  if (totals.records === 0) return <Empty text={`No Daily Production records in ${rangeLabel}.`} />;

  const periodCells = (p: PeriodRow, strong = false) => {
    const cls = `px-3 py-2.5 text-right tabular-nums${strong ? " font-semibold" : ""}`;
    return (
      <>
        <td className={cls}>{p.records}</td>
        <td className={cls}>{p.batches}</td>
        <td className={cls}>{p.cycles}</td>
        {mixerLabels.map((l) => (
          <td key={l} className={cls}>{p.mixerCycles[l] || "—"}</td>
        ))}
        <td className={cls}>{p.changeEntries ? `${p.changeEntries} (${p.changedMixers} mixer${p.changedMixers === 1 ? "" : "s"})` : "—"}</td>
        <td className={cls}>{kg(p.pigmentKg)}</td>
        <td className={cls}>{kg(p.materialKg)}</td>
      </>
    );
  };

  const changeColumns: Column<CycleChangeRow>[] = [
    { key: "date", header: "Date", render: (c) => day(c.date), sort: (c) => c.date, className: "whitespace-nowrap" },
    { key: "serial", header: "S.No.", render: (c) => c.serialNo, sort: (c) => c.serialNo },
    { key: "batch", header: "Batch", render: (c) => <span className="font-semibold text-brand-800">{c.batchNumber}</span>, sort: (c) => c.batchNumber },
    { key: "design", header: "Design", render: (c) => c.designName, sort: (c) => c.designName },
    { key: "mixer", header: "Mixer", render: (c) => c.mixer, sort: (c) => c.mixer, className: "whitespace-nowrap" },
    { key: "seq", header: "Change", render: (c) => `#${c.seq}`, sort: (c) => c.seq },
    { key: "range", header: "Cycles", render: (c) => `${c.range} (${c.cycles})`, className: "whitespace-nowrap" },
    { key: "pigments", header: "Pigments (per cycle)", render: (c) => c.pigments, className: "min-w-[180px]" },
    { key: "kg", header: "Pigment Consumed", align: "right", render: (c) => kg(c.pigmentKg), sort: (c) => c.pigmentKg },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Production Records" value={totals.records} />
        <Stat label="Total Cycles" value={totals.cycles} />
        <Stat label="Cycle Changes" value={totals.changeEntries} />
        <Stat label="Pigment Consumed" value={kg(totals.pigmentKg)} />
      </div>

      <section className="card p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-800">Period Summary</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className={`${th} text-left`}>Period</th>
                <th className={`${th} text-right`}>Records</th>
                <th className={`${th} text-right`}>Batches</th>
                <th className={`${th} text-right`}>Total Cycles</th>
                {mixerLabels.map((l) => (
                  <th key={l} className={`${th} text-right`}>{l} Cycles</th>
                ))}
                <th className={`${th} text-right`}>Cycle Changes</th>
                <th className={`${th} text-right`}>Pigment</th>
                <th className={`${th} text-right`}>Materials</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {periods.map((p) => (
                <tr key={p.key}>
                  <td className="whitespace-nowrap px-3 py-2.5 font-medium text-gray-900">{p.label}</td>
                  {periodCells(p)}
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50">
              <tr>
                <td className="px-3 py-2.5 font-semibold text-gray-900">Total</td>
                {periodCells(totals, true)}
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="card p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-800">Mixer-wise Production</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className={`${th} text-left`}>Mixer</th>
                <th className={`${th} text-right`}>Records Used In</th>
                <th className={`${th} text-right`}>Cycles</th>
                <th className={`${th} text-right`}>Records with Cycle Change</th>
                <th className={`${th} text-right`}>Change Entries</th>
                <th className={`${th} text-right`}>Pigment Consumed</th>
                <th className={`${th} text-right`}>Materials Consumed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mixers.map((m) => (
                <tr key={m.label} className={m.records === 0 ? "text-gray-400" : ""}>
                  <td className="px-3 py-2.5 font-semibold">{m.label}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.records}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.cycles}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.changedRecords}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.changeEntries}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{kg(m.pigmentKg)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{kg(m.materialKg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-800">Cycle-change Summary</h3>
        <DataTable
          rows={changes}
          columns={changeColumns}
          onRowClick={(c) => open({ type: "production", id: c.recordId })}
          emptyText="No cycle-time changes in this period."
        />
      </section>
      {modal}
    </div>
  );
}

// ---- 2. Consumption & cost -----------------------------------------------------

function TotalsTable({ title, rows }: { title: string; rows: { name: string; kg: number; records: number }[] }) {
  return (
    <section className="card p-5">
      <h3 className="mb-3 text-sm font-semibold text-gray-800">{title}</h3>
      {rows.length === 0 ? (
        <Empty text="Nothing consumed in this period." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className={`${th} text-left`}>Name</th>
                <th className={`${th} text-right`}>Records</th>
                <th className={`${th} text-right`}>Consumed</th>
                <th className={`${th} text-right`}>Rate</th>
                <th className={`${th} text-right`}>Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.name}>
                  <td className="px-3 py-2.5 font-medium text-gray-900">{r.name}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.records}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{kg(r.kg)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-400">—</td>
                  <td className="px-3 py-2.5 text-right text-gray-400">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function ConsumptionView({ report, rangeLabel }: { report: ConsumptionReport; rangeLabel: string }) {
  const { open, modal } = useDetail();
  if (report.rows.length === 0) return <Empty text={`No Daily Production records in ${rangeLabel}.`} />;

  const list = (items: { name: string; kg: number }[]) =>
    items.length ? items.map((i) => `${i.name} ${formatQty(i.kg)}`).join(", ") : "—";
  const columns: Column<ConsumptionRow>[] = [
    { key: "date", header: "Date", render: (r) => day(r.date), sort: (r) => r.date, className: "whitespace-nowrap" },
    { key: "serial", header: "S.No.", render: (r) => r.serialNo, sort: (r) => r.serialNo },
    { key: "batch", header: "Batch", render: (r) => <span className="font-semibold text-brand-800">{r.batchNumber}</span>, sort: (r) => r.batchNumber },
    { key: "loc", header: "LOC", render: (r) => r.locNumber, sort: (r) => r.locNumber },
    { key: "design", header: "Design", render: (r) => r.designName, sort: (r) => r.designName },
    { key: "pigments", header: "Pigments/Colors (kg)", render: (r) => list(r.pigments), className: "min-w-[200px] text-gray-700" },
    { key: "pigKg", header: "Pigment Total", align: "right", render: (r) => kg(r.pigmentKg), sort: (r) => r.pigmentKg },
    { key: "materials", header: "Materials (kg)", render: (r) => list(r.materials), className: "min-w-[200px] text-gray-700" },
    { key: "matKg", header: "Materials Total", align: "right", render: (r) => kg(r.materialKg), sort: (r) => r.materialKg },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Production Records" value={report.rows.length} />
        <Stat label="Pigment Consumed" value={kg(report.pigmentKg)} />
        <Stat label="Materials Consumed" value={kg(report.materialKg)} />
        <Stat label="Total Cost" value={<span className="text-gray-400">—</span>} />
      </div>

      <section className="card p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-800">Production-wise Consumption</h3>
        <DataTable
          rows={report.rows}
          columns={columns}
          onRowClick={(r) => open({ type: "production", id: r.id })}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-2 [&>*]:min-w-0">
        <TotalsTable title="Pigment/Color Consumption Summary" rows={report.pigmentTotals} />
        <TotalsTable title="Materials Consumption Summary" rows={report.materialTotals} />
      </div>
      {modal}
    </div>
  );
}
