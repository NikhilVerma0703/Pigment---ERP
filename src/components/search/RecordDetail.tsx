"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { FlaskConical, Loader2, X } from "lucide-react";
import { fetchDetail, type DetailResult } from "@/app/searching/actions";
import { formatQty } from "@/lib/formula/calc";
import type { DetailRef, FormulaDetail, PigmentLine, ProductionDetail } from "@/lib/search/types";

const unit = (u: string) => (u === "GM" ? "gm" : "kg");
const day = (d: string) => format(parseISO(d), "dd MMM yyyy");
const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600";
const thR = `${th} text-right`;
const td = "px-3 py-2";
const tdR = "px-3 py-2 text-right tabular-nums";

/** Modal with the complete saved record behind a search result. */
export function RecordDetailModal({ target, onClose }: { target: DetailRef | null; onClose: () => void }) {
  const [result, setResult] = useState<DetailResult | null>(null);

  useEffect(() => {
    if (!target) return;
    let live = true;
    setResult(null);
    fetchDetail(target).then((r) => live && setResult(r));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      live = false;
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [target, onClose]);

  if (!target) return null;
  const title =
    result?.type === "formula"
      ? `Formula ${result.detail.name}`
      : result?.type === "production"
        ? `Daily Production — S.No. ${result.detail.serialNo}`
        : "Record";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 md:p-8" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-5xl rounded-card bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-bold text-pacific-dark">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">
          {!result ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading record…
            </div>
          ) : result.type === "missing" ? (
            <p className="py-16 text-center text-sm text-gray-500">This record no longer exists.</p>
          ) : result.type === "formula" ? (
            <FormulaView f={result.detail} />
          ) : (
            <ProductionView p={result.detail} />
          )}
        </div>
      </div>
    </div>
  );
}

function Facts({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{k}</dt>
          <dd className="mt-0.5 font-medium text-gray-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function FormulaView({ f }: { f: FormulaDetail }) {
  return (
    <div className="space-y-6">
      <Facts
        items={[
          ["Date", day(f.date)],
          ["S.No.", f.serialNo],
          ["Formula Type", f.typeLabel],
          ["Mixing Time", `${f.mixingHours} h ${f.mixingMinutes} min`],
        ]}
      />
      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-800">Materials / Colors Used</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className={th}>S.No.</th>
                <th className={th}>Material/Color</th>
                <th className={th}>Unit</th>
                <th className={thR}>Quantity</th>
                <th className={thR}>Calculation</th>
                <th className={thR}>Required Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {f.items.map((i) => (
                <tr key={i.lineNo}>
                  <td className={td}>{i.lineNo}</td>
                  <td className={`${td} font-medium`}>
                    <span className="inline-flex items-center gap-1.5">
                      {i.isFormula && <FlaskConical className="h-3.5 w-3.5 text-brand-500" aria-label="Saved formula" />}
                      {i.name}
                    </span>
                  </td>
                  <td className={td}>{unit(i.unit)}</td>
                  <td className={tdR}>{formatQty(i.quantity)}</td>
                  <td className={`${tdR} text-gray-500`}>{formatQty(i.quantity)} × {formatQty(f.rate)}</td>
                  <td className={`${tdR} font-semibold`}>{formatQty(i.requiredQuantity)} {unit(i.unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-800">Requirement Table</h3>
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              <tr><th className="w-1/2 bg-gray-50 px-3 py-2 text-left font-semibold text-gray-700">Total Quantity Used (in kg)</th><td className={tdR}>{formatQty(f.totalUsedKg)} kg</td></tr>
              <tr><th className="bg-gray-50 px-3 py-2 text-left font-semibold text-gray-700">Total Quantity Required</th><td className={tdR}>{formatQty(f.requiredKg)} kg</td></tr>
              <tr><th className="bg-gray-50 px-3 py-2 text-left font-semibold text-gray-700">Consumption Rate</th><td className={tdR}>{formatQty(f.requiredKg)} ÷ {formatQty(f.totalUsedKg)} = <span className="font-semibold text-brand-700">{formatQty(f.rate)}</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PigmentLines({ rows }: { rows: PigmentLine[] }) {
  if (rows.length === 0) return <p className="text-sm text-gray-500">No pigments recorded.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className={th}>S.No.</th>
            <th className={th}>Pigment/Color</th>
            <th className={thR}>Qty per Cycle</th>
            <th className={thR}>Cycles</th>
            <th className={thR}>Consumed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((p) => (
            <tr key={p.lineNo}>
              <td className={td}>{p.lineNo}</td>
              <td className={`${td} font-medium`}>
                <span className="inline-flex items-center gap-1.5">
                  {p.isFormula && <FlaskConical className="h-3.5 w-3.5 text-brand-500" aria-label="Saved formula" />}
                  {p.name}
                </span>
              </td>
              <td className={tdR}>{formatQty(p.quantity)} {unit(p.unit)}</td>
              <td className={tdR}>× {p.cycles}</td>
              <td className={`${tdR} font-semibold`}>{formatQty(p.consumedKg)} kg</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductionView({ p }: { p: ProductionDetail }) {
  return (
    <div className="space-y-6">
      <Facts
        items={[
          ["Date", day(p.date)],
          ["S.No.", p.serialNo],
          ["Batch Number", p.batchNumber],
          ["LOC Number", p.locNumber],
          ["Production/Design Name", p.designName],
          ["Total Cycles", p.totalCycles],
          ["Pigment Consumed", `${formatQty(p.pigmentKg)} kg`],
          ["Materials Consumed", `${formatQty(p.materialKg)} kg`],
        ]}
      />
      {p.mixers.map((m) => (
        <section key={m.label} className="overflow-hidden rounded-lg border border-gray-200">
          <header className="border-b border-gray-200 bg-brand-50/60 px-4 py-2.5 font-bold text-brand-800">{m.label}</header>
          <div className="space-y-5 p-4">
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-800">
                A. Pigment/Color Details
                {m.cycleTimeChanged && m.changes.length > 0 && (
                  <span className="ml-2 font-normal text-gray-500">
                    (used for {m.baseCycles} cycle{m.baseCycles === 1 ? "" : "s"} not covered by a change)
                  </span>
                )}
              </h4>
              <PigmentLines rows={m.pigments} />
              <p className="mt-2 text-sm text-gray-700">
                Cycle Time Changed: <span className="font-semibold">{m.cycleTimeChanged ? `Yes — ${m.changes.length} time${m.changes.length === 1 ? "" : "s"}` : "No"}</span>
              </p>
              {m.changes.map((c) => (
                <div key={c.seq} className="mt-3 rounded-lg bg-gray-50 p-3">
                  <div className="mb-2 text-sm font-semibold text-brand-700">
                    Change {c.seq}: cycles {c.fromCycle}–{c.toCycle}
                  </div>
                  <PigmentLines rows={c.pigments} />
                </div>
              ))}
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-800">B. Materials Consumption</h4>
              {m.materials.length === 0 ? (
                <p className="text-sm text-gray-500">No materials recorded.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className={th}>S.No.</th>
                        <th className={th}>Material</th>
                        <th className={thR}>Quantity Used</th>
                        <th className={thR}>In kg</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {m.materials.map((x) => (
                        <tr key={x.lineNo}>
                          <td className={td}>{x.lineNo}</td>
                          <td className={`${td} font-medium`}>{x.name}</td>
                          <td className={tdR}>{formatQty(x.quantity)} {unit(x.unit)}</td>
                          <td className={`${tdR} font-semibold`}>{formatQty(x.kg)} kg</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
