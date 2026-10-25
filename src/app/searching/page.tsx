import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Boxes, FlaskConical, Package } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchFilters, type FilterField } from "@/components/search/SearchFilters";
import { FormulaResults, MaterialResults, PigmentResults, ProductionResults } from "@/components/search/SearchResults";
import { formatQty, type Unit } from "@/lib/formula/calc";
import { FORMULA_TYPE_OPTIONS } from "@/lib/formula/constants";
import { MIXERS } from "@/lib/production/constants";
import { parseFilters, parseTab, SEARCH_TABS, type SearchTab } from "@/lib/search/filters";
import {
  getSearchSuggestions,
  searchFormulas,
  searchMaterials,
  searchPigments,
  searchProduction,
} from "@/lib/search/queries";
import type { SearchSuggestions } from "@/lib/search/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Searching" };

// Results always come from the saved records as they are now.
export const dynamic = "force-dynamic";

const TAB_ICONS: Record<SearchTab, typeof FlaskConical> = {
  formulas: FlaskConical,
  production: Package,
  pigments: BarChart3,
  materials: Boxes,
};

const DATES: FilterField = { key: "dates", label: "Date (from – to)", type: "dateRange" };

function fieldsFor(tab: SearchTab, s: SearchSuggestions): FilterField[] {
  switch (tab) {
    case "formulas":
      return [
        { key: "name", label: "Formula Name", type: "suggest", suggestions: s.formulaNames, placeholder: "e.g. SW (partial match)" },
        { key: "type", label: "Formula Type", type: "select", options: FORMULA_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })) },
        { key: "material", label: "Material/Color Used", type: "suggest", suggestions: s.formulaMaterials },
        DATES,
      ];
    case "production":
      return [
        { key: "batch", label: "Batch Number", type: "suggest", suggestions: s.batches },
        { key: "loc", label: "LOC Number", type: "suggest", suggestions: s.locs },
        { key: "design", label: "Production/Design Name", type: "suggest", suggestions: s.designs },
        { key: "pigment", label: "Formula/Pigment Used", type: "suggest", suggestions: s.pigments },
        DATES,
      ];
    case "pigments":
      return [
        { key: "pigment", label: "Pigment/Color Name", type: "suggest", suggestions: s.pigments, placeholder: "e.g. SW, Black, Green" },
        { key: "batch", label: "Batch Number", type: "suggest", suggestions: s.batches },
        { key: "loc", label: "LOC Number", type: "suggest", suggestions: s.locs },
        DATES,
      ];
    case "materials":
      return [
        { key: "material", label: "Material Name", type: "suggest", suggestions: s.materials, placeholder: "e.g. Grit, Resin" },
        { key: "batch", label: "Batch Number", type: "suggest", suggestions: s.batches },
        { key: "loc", label: "LOC Number", type: "suggest", suggestions: s.locs },
        { key: "mixer", label: "Mixer", type: "select", options: MIXERS.map((m) => ({ value: m.value, label: m.label })) },
        DATES,
      ];
  }
}

const qty = (q: number, u: Unit) => `${formatQty(q)} ${u === "GM" ? "gm" : "kg"}`;

async function results(tab: SearchTab, filters: Record<string, string>) {
  switch (tab) {
    case "formulas": {
      const rows = (await searchFormulas(filters)).map((f) => ({
        id: f.id,
        serialNo: f.serialNo,
        date: f.date,
        name: f.name,
        typeLabel: f.typeLabel,
        mixing: `${f.mixingHours} h ${f.mixingMinutes} min`,
        ingredients: f.items.map((i) => `${i.name} ${qty(i.quantity, i.unit)}`).join(", "),
        itemCount: f.items.length,
        totalUsedKg: f.totalUsedKg,
        requiredKg: f.requiredKg,
        rate: f.rate,
      }));
      return { count: rows.length, node: <FormulaResults rows={rows} /> };
    }
    case "production": {
      const rows = (await searchProduction(filters)).map((p) => {
        const names = new Map<string, string>();
        for (const m of p.mixers)
          for (const l of [...m.pigments, ...m.changes.flatMap((c) => c.pigments)])
            if (!names.has(l.name.toLowerCase())) names.set(l.name.toLowerCase(), l.name);
        return {
          id: p.id,
          serialNo: p.serialNo,
          date: p.date,
          batchNumber: p.batchNumber,
          locNumber: p.locNumber,
          designName: p.designName,
          totalCycles: p.totalCycles,
          mixers: p.mixers.map((m) => m.label).join(", "),
          pigments: [...names.values()].join(", "),
          pigmentKg: p.pigmentKg,
          materialKg: p.materialKg,
        };
      });
      return { count: rows.length, node: <ProductionResults rows={rows} /> };
    }
    case "pigments": {
      const { rows, summary } = await searchPigments(filters);
      return { count: rows.length, node: <PigmentResults rows={rows} summary={summary} /> };
    }
    case "materials": {
      const { rows, daily, totals } = await searchMaterials(filters);
      return { count: rows.length, node: <MaterialResults rows={rows} daily={daily} totals={totals} /> };
    }
  }
}

const NOTES: Record<SearchTab, string> = {
  formulas: "Search saved formulas by name (partial matches), type, an ingredient they use, or date.",
  production: "Combine any filters — e.g. Batch Number + Date + Design — or use just one.",
  pigments: "Stock added and every consumption, with the stock balance after each transaction. All quantities in kg.",
  materials: "Consumption only — materials have no stock. All quantities in kg.",
};

export default async function SearchingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tab = parseTab(params);
  const filters = parseFilters(tab, params);
  const [suggestions, result] = await Promise.all([getSearchSuggestions(), results(tab, filters)]);

  return (
    <div className="space-y-5">
      <PageHeader title="Searching" description="Find saved formulas, production records, pigment stock movements and material consumption." />

      <nav className="flex flex-wrap gap-2" aria-label="Search sections">
        {SEARCH_TABS.map((t, i) => {
          const Icon = TAB_ICONS[t.value];
          const active = t.value === tab;
          return (
            <Link
              key={t.value}
              href={`/searching?tab=${t.value}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition",
                active ? "border-brand bg-brand text-white shadow-sm" : "border-gray-300 bg-white text-gray-700 hover:border-brand-300 hover:bg-brand-50",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {i + 1}. {t.label}
            </Link>
          );
        })}
      </nav>

      <p className="text-sm text-gray-600">{NOTES[tab]}</p>

      <SearchFilters tab={tab} fields={fieldsFor(tab, suggestions)} applied={filters} resultCount={result.count} />

      <section className="card p-5">{result.node}</section>
    </div>
  );
}
