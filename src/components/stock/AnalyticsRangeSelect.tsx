"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ANALYTICS_RANGES, type AnalyticsRange } from "@/lib/stock/constants";

/** Range for the Consumption Analytics charts. Kept in ?range= so the page
 *  re-renders on the server with that window and a reload keeps it. */
export function AnalyticsRangeSelect({ value }: { value: AnalyticsRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="analytics-range" className="sr-only">Analytics range</label>
      <select
        id="analytics-range"
        value={value}
        disabled={pending}
        onChange={(e) =>
          startTransition(() => router.replace(`${pathname}?range=${e.target.value}`, { scroll: false }))
        }
        className="field-input w-auto py-1.5 pr-8 font-medium"
      >
        {ANALYTICS_RANGES.map((d) => (
          <option key={d} value={d}>Last {d} days</option>
        ))}
      </select>
      {pending && <Loader2 className="h-4 w-4 animate-spin text-brand-500" aria-label="Updating charts" />}
    </div>
  );
}
