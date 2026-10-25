"use client";

import { useState } from "react";
import { format } from "date-fns";
import { AlertCircle, CheckCircle2, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DOWNLOAD_TYPES, PERIOD_KINDS, resolvePeriod, type DownloadType, type PeriodKind } from "@/lib/reports/period";
import { cn } from "@/lib/utils";

type Feedback = { kind: "error" | "info" | "success"; text: string } | null;

/** Report Type + Select Period → an .xlsx from the saved records. */
export function DownloadForm({ months }: { months: { value: string; label: string }[] }) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [type, setType] = useState<DownloadType | "">("");
  const [period, setPeriod] = useState<PeriodKind>("today");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [month, setMonth] = useState(months[0]?.value ?? "");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!type) return setFeedback({ kind: "error", text: "Select a report type." });
    const resolved = resolvePeriod({ period, from, to, month });
    if (!resolved.ok) return setFeedback({ kind: "error", text: resolved.error });

    setBusy(true);
    try {
      const q = new URLSearchParams({ type, period, ...(period === "custom" ? { from, to } : {}), ...(period === "month" ? { month } : {}) });
      const res = await fetch(`/api/reports/download?${q}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "The report could not be created." }));
        setFeedback({ kind: res.status === 404 ? "info" : "error", text: body.error });
        return;
      }
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "report.xlsx";
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: name });
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      const count = res.headers.get("X-Record-Count");
      const text = `Downloaded ${name}${count ? ` (${count} record${count === "1" ? "" : "s"})` : ""}.`;
      setFeedback({ kind: "success", text });
      toast.success("Report downloaded");
    } catch {
      setFeedback({ kind: "error", text: "The download failed. Check the connection and try again." });
    } finally {
      setBusy(false);
    }
  };

  const Icon = feedback?.kind === "success" ? CheckCircle2 : AlertCircle;

  return (
    <form onSubmit={submit} className="card mx-auto max-w-2xl space-y-5 p-6" noValidate>
      <div>
        <label htmlFor="d-type" className="field-label">Report Type</label>
        <select id="d-type" className="field-input" value={type} onChange={(e) => setType(e.target.value as DownloadType)}>
          <option value="" disabled>Select a report…</option>
          {DOWNLOAD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="field-label">Select Period</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {PERIOD_KINDS.map((p) => (
            <label
              key={p.value}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
                period === p.value ? "border-brand bg-brand-50 text-brand-800" : "border-gray-300 text-gray-700 hover:bg-gray-50",
              )}
            >
              <input type="radio" name="period" value={p.value} checked={period === p.value} onChange={() => setPeriod(p.value)} className="accent-brand" />
              {p.label}
            </label>
          ))}
        </div>

        {period === "today" && <p className="mt-2 text-sm text-gray-600">Records dated {format(new Date(), "dd MMM yyyy")}.</p>}
        {period === "custom" && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input type="date" aria-label="From date" className="field-input w-auto" value={from} max={today} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-sm text-gray-500">to</span>
            <input type="date" aria-label="To date" className="field-input w-auto" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
            <span className="text-xs text-gray-500">Use the same date twice for a single day.</span>
          </div>
        )}
        {period === "month" && (
          <select aria-label="Month" className="field-input mt-3 w-auto" value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        )}
      </fieldset>

      {feedback && (
        <div
          role={feedback.kind === "error" ? "alert" : "status"}
          className={cn(
            "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm",
            feedback.kind === "error" && "border-red-200 bg-red-50 text-red-800",
            feedback.kind === "info" && "border-amber-200 bg-amber-50 text-amber-900",
            feedback.kind === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
          )}
        >
          <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {feedback.text}
        </div>
      )}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {busy ? "Preparing…" : "Download Excel"}
        </button>
      </div>
    </form>
  );
}
