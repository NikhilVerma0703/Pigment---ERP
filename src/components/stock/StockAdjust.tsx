"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { History, Loader2, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { adjustStock } from "@/app/stocks-consumption/actions";
import { cn } from "@/lib/utils";

/** "Adjust" and "History" actions for one pigment in the Live Stock table. */
export function StockActions({ pigmentId, name }: { pigmentId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<"KG" | "GM">("KG");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, startSaving] = useTransition();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !panel.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const submit = () =>
    startSaving(async () => {
      setError("");
      const result = await adjustStock({ pigmentId, direction, quantity, unit, note });
      if (!result.ok) return setError(result.error);
      toast.success(result.newRemainingHint);
      setOpen(false);
      setQuantity("");
      setNote("");
      router.refresh();
    });

  return (
    <div className="relative flex items-center justify-end gap-1" ref={panel}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
        aria-expanded={open}
        aria-label={`Adjust stock of ${name}`}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" /> Adjust
      </button>
      <Link
        href={`/searching?tab=pigments&pigment=${encodeURIComponent(name)}`}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100"
        aria-label={`Stock history of ${name}`}
      >
        <History className="h-3.5 w-3.5" /> History
      </Link>

      {open && (
        // A centred dialog on every screen size: inside the table it would be
        // cut off by the table's horizontal scroll box, especially on phones.
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Adjust stock of ${name}`}
            className="w-full max-w-sm rounded-card border border-gray-200 bg-white p-4 text-left shadow-xl"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">Adjust {name}</span>
              <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-gray-400 hover:bg-gray-100" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mb-2 grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-0.5 text-xs font-semibold">
              {(["add", "remove"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  className={cn(
                    "rounded-md py-1.5 transition",
                    direction === d ? (d === "add" ? "bg-emerald-600 text-white" : "bg-red-600 text-white") : "text-gray-600",
                  )}
                >
                  {d === "add" ? "+ Add stock" : "− Remove stock"}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="decimal"
                autoFocus
                placeholder="0.000"
                aria-label="Quantity"
                className="field-input text-right tabular-nums"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submit())}
              />
              <select aria-label="Unit" className="field-input w-24" value={unit} onChange={(e) => setUnit(e.target.value as "KG" | "GM")}>
                <option value="KG">Kg</option>
                <option value="GM">Gm</option>
              </select>
            </div>
            <input
              type="text"
              placeholder="Note (optional), e.g. received batch, recount"
              aria-label="Note"
              maxLength={200}
              className="field-input mt-2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {error && <p className="field-error">{error}</p>}
            <button type="button" onClick={submit} disabled={saving} className="btn-primary mt-3 w-full">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save adjustment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
