"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Eraser, Loader2, RotateCcw, Search } from "lucide-react";
import { SuggestCombobox } from "@/components/ui/SuggestCombobox";
import { filtersToQuery, type Filters, type SearchTab } from "@/lib/search/filters";
import { valueSuggestions } from "@/lib/suggestions";

export type FilterField =
  | { key: string; label: string; type: "suggest"; suggestions: string[]; placeholder?: string }
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[] }
  | { key: "dates"; label: string; type: "dateRange" };

/**
 * One row of filters for a subsection. Any combination can be used; empty
 * fields are ignored. Search applies them (they go into the URL), Clear
 * Filters empties the fields, Reset empties them and shows all records again.
 * The Excel download always exports the filters currently applied.
 */
export function SearchFilters({
  tab,
  fields,
  applied,
  resultCount,
}: {
  tab: SearchTab;
  fields: FilterField[];
  applied: Filters;
  resultCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Filters>(applied);
  // A new search (or tab) arriving from the server resets the form to it.
  const appliedKey = JSON.stringify(applied);
  useEffect(() => setValues(JSON.parse(appliedKey)), [appliedKey]);

  const set = (key: string, v: string) => setValues((s) => ({ ...s, [key]: v }));
  const go = (f: Filters) => startTransition(() => router.push(`/searching?${filtersToQuery(tab, f)}`, { scroll: false }));
  const dateError = values.from && values.to && values.from > values.to ? "From date is after To date" : "";
  const appliedCount = Object.keys(applied).length;

  return (
    <form
      className="card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!dateError) go(values);
      }}
      onKeyDown={(e) => {
        // Enter in a suggestion field picks the suggestion; elsewhere it searches.
        if (e.key === "Enter" && (e.target as HTMLElement).getAttribute("role") === "combobox") e.preventDefault();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 [&>*]:min-w-0">
        {fields.map((field) =>
          field.type === "dateRange" ? (
            <div key="dates" className="sm:col-span-2">
              <span className="field-label">{field.label}</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  aria-label="From date"
                  className="field-input min-w-0 flex-1"
                  value={values.from ?? ""}
                  max={values.to || undefined}
                  onChange={(e) => set("from", e.target.value)}
                />
                <span className="text-sm text-gray-500">to</span>
                <input
                  type="date"
                  aria-label="To date"
                  className="field-input min-w-0 flex-1"
                  value={values.to ?? ""}
                  min={values.from || undefined}
                  onChange={(e) => set("to", e.target.value)}
                />
              </div>
              {dateError && <p className="field-error">{dateError}</p>}
            </div>
          ) : field.type === "select" ? (
            <div key={field.key}>
              <label htmlFor={`f-${field.key}`} className="field-label">{field.label}</label>
              <select
                id={`f-${field.key}`}
                className="field-input"
                value={values[field.key] ?? ""}
                onChange={(e) => set(field.key, e.target.value)}
              >
                <option value="">All</option>
                {field.options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          ) : (
            <div key={field.key}>
              <label htmlFor={`f-${field.key}`} className="field-label">{field.label}</label>
              <SuggestCombobox
                id={`f-${field.key}`}
                value={values[field.key] ?? ""}
                onChange={(v) => set(field.key, v)}
                suggestions={valueSuggestions(field.suggestions)}
                placeholder={field.placeholder ?? "Type to search…"}
                newLabel="Search for"
              />
            </div>
          ),
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending || !!dateError}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search
        </button>
        <button type="button" className="btn-secondary" onClick={() => setValues({})} disabled={pending}>
          <Eraser className="h-4 w-4" /> Clear Filters
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            setValues({});
            go({});
          }}
          disabled={pending}
        >
          <RotateCcw className="h-4 w-4" /> Reset
        </button>
        <span className="text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{resultCount}</span> result{resultCount === 1 ? "" : "s"}
          {appliedCount > 0 ? ` · ${appliedCount} filter${appliedCount === 1 ? "" : "s"} applied` : " · all records"}
        </span>
        <a
          href={`/api/search/export?${filtersToQuery(tab, applied)}`}
          className="btn-secondary ml-auto"
          download
          aria-disabled={resultCount === 0}
          onClick={(e) => resultCount === 0 && e.preventDefault()}
        >
          <Download className="h-4 w-4" /> Download Excel
        </a>
      </div>
    </form>
  );
}
