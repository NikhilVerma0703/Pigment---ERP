"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SuggestCombobox } from "@/components/ui/SuggestCombobox";
import { nameKey } from "@/lib/utils";

/**
 * Search Batch Number: pick a saved production record and its Batch Details
 * Report loads below. The choice goes into ?batch=<record id>, the same as
 * clicking a Batch Number in Recent Pigment Packing Details.
 */
export function BatchSearch({ options, selectedId }: { options: { id: string; label: string }[]; selectedId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const selectedLabel = options.find((o) => o.id === selectedId)?.label ?? "";
  const [text, setText] = useState(selectedLabel);
  useEffect(() => setText(selectedLabel), [selectedLabel]);

  const byLabel = useMemo(() => new Map(options.map((o) => [nameKey(o.label), o.id])), [options]);
  const suggestions = useMemo(() => options.map((o) => ({ kind: "value" as const, id: o.id, name: o.label })), [options]);

  const choose = (value: string) => {
    setText(value);
    const id = byLabel.get(nameKey(value));
    if (!id || id === selectedId) return;
    const q = new URLSearchParams(params.toString());
    q.set("batch", id);
    startTransition(() => router.replace(`${pathname}?${q}`, { scroll: false }));
  };

  return (
    <div className="mb-5 flex flex-wrap items-end gap-3">
      <div className="w-full max-w-sm">
        <label htmlFor="batch-search" className="field-label">Search Batch Number</label>
        <SuggestCombobox
          id="batch-search"
          value={text}
          onChange={choose}
          suggestions={suggestions}
          placeholder="Type or pick a batch number"
          newLabel="No saved batch"
        />
      </div>
      {pending && <Loader2 className="mb-3 h-5 w-5 animate-spin text-brand-500" aria-label="Loading report" />}
    </div>
  );
}
