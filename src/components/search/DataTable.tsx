"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Value to sort by; the column is not sortable without it. */
  sort?: (row: T) => string | number | null;
  align?: "left" | "right";
  className?: string;
}

const PAGE_SIZES = [25, 50, 100];

/** Sortable, paginated results table. Rows are clickable when onRowClick is given. */
export function DataTable<T extends { id: string }>({
  rows,
  columns,
  onRowClick,
  emptyText = "No records match these filters.",
  caption,
}: {
  rows: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  emptyText?: string;
  caption?: string;
}) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);

  useEffect(() => setPage(0), [rows, pageSize, sort]);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    const get = col.sort;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      if (x === y) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * dir;
    });
  }, [rows, columns, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = sorted.slice(page * pageSize, page * pageSize + pageSize);

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-12 text-center">
        <SearchX className="h-8 w-8 text-gray-300" aria-hidden />
        <p className="text-sm text-gray-500">{emptyText}</p>
      </div>
    );
  }

  return (
    <div>
      {caption && <p className="mb-2 text-xs text-gray-500">{caption}</p>}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600">
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={c.key}
                    className={cn("whitespace-nowrap px-3 py-2", c.align === "right" ? "text-right" : "text-left")}
                    aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                  >
                    {c.sort ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className={cn("inline-flex items-center gap-1 uppercase hover:text-brand-700", active && "text-brand-700")}
                      >
                        {c.header}
                        <Icon className={cn("h-3 w-3", !active && "opacity-40")} aria-hidden />
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {current.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onRowClick(row)) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                className={cn(onRowClick && "cursor-pointer outline-none hover:bg-brand-50/60 focus-visible:bg-brand-50")}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-3 py-2.5", c.align === "right" && "text-right tabular-nums", c.className)}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
        <span>
          Showing <span className="font-medium text-gray-900">{page * pageSize + 1}–{Math.min(sorted.length, (page + 1) * pageSize)}</span> of{" "}
          <span className="font-medium text-gray-900">{sorted.length}</span>
        </span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2">
            Rows
            <select className="field-input w-auto py-1" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <button type="button" className="btn-secondary px-2 py-1" onClick={() => setPage((p) => p - 1)} disabled={page === 0} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="tabular-nums">Page {page + 1} / {pages}</span>
          <button type="button" className="btn-secondary px-2 py-1" onClick={() => setPage((p) => p + 1)} disabled={page >= pages - 1} aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
