"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const DELETE_CONFIRM = "Do you want to permanently delete this record?";

/** The Review cell: opens the read-only overview of the record. */
export function ReviewButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
      aria-label={`Review ${label}`}
      title="Review"
    >
      <Eye className="h-4 w-4" /> Review
    </button>
  );
}

/**
 * The Action cell: Edit reopens the page's form with this record (?edit=id);
 * Delete asks for confirmation, then deletes and refreshes the page.
 */
export function EditDeleteButtons({
  id,
  label,
  basePath,
  remove,
}: {
  id: string;
  label: string;
  basePath: string;
  remove: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [deleting, startDeleting] = useTransition();

  const onDelete = () => {
    if (!window.confirm(DELETE_CONFIRM)) return;
    startDeleting(async () => {
      const result = await remove(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${label} deleted`);
      // Deleting the record that is open in the form closes the edit.
      if (params.get("edit") === id) router.replace(basePath, { scroll: false });
      router.refresh();
    });
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={`${basePath}?edit=${id}`}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
        aria-label={`Edit ${label}`}
        title="Edit"
      >
        <Pencil className="h-3.5 w-3.5" /> Edit
      </Link>
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
        aria-label={`Delete ${label}`}
        title="Delete"
      >
        {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete
      </button>
    </div>
  );
}
