"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ArrowLeft, FileSpreadsheet, FileText, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { kgText, type BatchReport } from "@/lib/reports/batch";
import { cn } from "@/lib/utils";

const th = "border border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600";
const td = "border border-gray-200 px-3 py-2 align-top";

/**
 * The Batch Details Report: basic information, the vertical Materials
 * Consumption table and the horizontal, cycle-wise Pigment Details table,
 * with Excel and PDF exports. Used on the Dashboard and in Searching.
 */
export function BatchReportView({
  report: r,
  backHref,
  showPrint,
  scrollIntoView,
}: {
  report: BatchReport;
  backHref?: string;
  showPrint?: boolean;
  /** Scroll to the report whenever a different batch is shown. */
  scrollIntoView?: boolean;
}) {
  const [pdfBusy, setPdfBusy] = useState(false);
  useEffect(() => {
    if (scrollIntoView) document.getElementById("batch-report")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [scrollIntoView, r.id]);
  const day = format(parseISO(r.date), "dd MMM yyyy");
  const fileBase = `batch-report_${r.batchNumber.replace(/[^\w.-]+/g, "_")}_${r.date}`;

  const exportPdf = async () => {
    setPdfBusy(true);
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const brand: [number, number, number] = [15, 76, 92];
      const head = { fillColor: brand, textColor: 255, fontStyle: "bold" as const };
      const styles = { fontSize: 9, cellPadding: 5, lineColor: [209, 213, 219] as [number, number, number], lineWidth: 0.5 };
      // jsPDF's built-in font has no "–" glyph in every viewer; a hyphen prints everywhere.
      const t = (s: string | number) => String(s).replace(/–/g, "-");

      doc.setFontSize(16);
      doc.setTextColor(...brand);
      doc.text(t(`Batch Details Report — ${r.batchNumber}`).replace("—", "-"), 40, 40);
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text(`Pigment ERP · generated ${format(new Date(), "dd MMM yyyy, HH:mm")}`, 40, 56);

      autoTable(doc, {
        startY: 70,
        head: [["Batch Number", "Date", "LOC Number", "Production / Design Name", "Total Cycles Running"]],
        body: [[r.batchNumber, day, r.locNumber, r.designName, String(r.totalCycles)].map(t)],
        headStyles: head,
        styles,
        theme: "grid",
      });

      const y1 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22;
      doc.setFontSize(12);
      doc.setTextColor(17, 39, 50);
      doc.text("Materials Consumption Details", 40, y1);
      autoTable(doc, {
        startY: y1 + 8,
        head: [["S.No.", "Material Name", "Material Size", ...r.mixers, "Total Quantity"].map(t)],
        body: r.materialRows.map((m) => [m.sno ?? "", m.material, m.size, ...m.perMixer.map(kgText), kgText(m.totalKg)].map(t)),
        headStyles: head,
        styles,
        theme: "grid",
        columnStyles: Object.fromEntries(
          Array.from({ length: r.mixers.length + 1 }, (_, i) => [i + 3, { halign: "right" as const }]),
        ),
      });

      const y2 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22;
      doc.text("Pigment Details", 40, y2);
      autoTable(doc, {
        startY: y2 + 8,
        head: [["Mixer", "Original Pigment Details", ...r.rangeColumns.map((c) => `Cycles ${c}`)].map(t)],
        body: r.pigmentRows.map((p) => [p.mixer, p.original, ...p.ranges].map(t)),
        headStyles: head,
        styles,
        theme: "grid",
      });

      doc.save(`${fileBase}.pdf`);
    } catch (err) {
      console.error(err);
      toast.error("The PDF could not be created.");
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="space-y-5" id="batch-report">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {backHref && (
          <Link href={backHref} className="btn-secondary">
            <ArrowLeft className="h-4 w-4" /> Back to Search
          </Link>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <a href={`/api/batch-report/${r.id}`} download className="btn-secondary">
            <FileSpreadsheet className="h-4 w-4 text-emerald-700" /> Export Excel
          </a>
          <button type="button" onClick={exportPdf} disabled={pdfBusy} className="btn-secondary">
            {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4 text-red-600" />} Export PDF
          </button>
          {showPrint && (
            <button type="button" onClick={() => window.print()} className="btn-secondary">
              <Printer className="h-4 w-4" /> Print
            </button>
          )}
        </div>
      </div>

      {/* 1. Basic batch information */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200 sm:grid-cols-3 lg:grid-cols-5">
        {(
          [
            ["Batch Number", r.batchNumber],
            ["Date", day],
            ["LOC Number", r.locNumber],
            ["Production / Design Name", r.designName],
            ["Total Number of Cycles Running", r.totalCycles],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="bg-white px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{k}</dt>
            <dd className={cn("mt-0.5 font-semibold text-gray-900", k === "Batch Number" && "text-brand-800")}>{v}</dd>
          </div>
        ))}
      </dl>

      {/* 2. Materials consumption — vertical */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-800">Materials Consumption Details</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr>
                <th className={`${th} w-14`}>S.No.</th>
                <th className={th}>Material Name</th>
                <th className={th}>Material Size</th>
                {r.mixers.map((m) => (
                  <th key={m} className={`${th} text-right`}>{m}</th>
                ))}
                <th className={`${th} bg-brand-50 text-right text-brand-800`}>Total Quantity</th>
              </tr>
            </thead>
            <tbody>
              {r.materialRows.map((m) => (
                <tr key={m.key} className={m.sno !== null ? "border-t-2 border-gray-200" : ""}>
                  <td className={`${td} text-gray-600`}>{m.sno ?? ""}</td>
                  <td className={`${td} font-medium text-gray-900`}>{m.material}</td>
                  <td className={`${td} text-gray-700`}>{m.size}</td>
                  {m.perMixer.map((v, i) => (
                    <td key={i} className={`${td} text-right tabular-nums ${v === null ? "text-gray-300" : ""}`}>{kgText(v)}</td>
                  ))}
                  <td className={`${td} bg-brand-50/40 text-right font-semibold tabular-nums ${m.totalKg === null ? "text-gray-300" : ""}`}>
                    {kgText(m.totalKg)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. Pigment details — horizontal, cycle-wise */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-800">Pigment Details</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr>
                <th className={`${th} w-36`}>Mixer</th>
                <th className={th}>Original Pigment Details</th>
                {r.rangeColumns.map((c) => (
                  <th key={c} className={th}>Cycles {c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.pigmentRows.map((p) => (
                <tr key={p.mixer}>
                  <td className={`${td} font-semibold text-gray-900`}>{p.mixer}</td>
                  <td className={`${td} text-gray-800`}>{p.original}</td>
                  {p.ranges.map((v, i) => (
                    <td key={i} className={`${td} ${v === "—" ? "text-gray-300" : "text-gray-800"}`}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
