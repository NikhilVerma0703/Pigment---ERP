import Link from "next/link";
import { PencilLine, X } from "lucide-react";

/** Shown above a form while it is editing a saved record. */
export function EditBanner({ label, cancelHref }: { label: string; cancelHref: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-amber-300 bg-amber-50 px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-amber-900">
        <PencilLine className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          Editing <span className="font-semibold">{label}</span>. Saving updates this record; no new record is created.
        </span>
      </div>
      <Link href={cancelHref} className="btn-secondary px-3 py-1.5 text-xs">
        <X className="h-3.5 w-3.5" /> Cancel edit
      </Link>
    </div>
  );
}
