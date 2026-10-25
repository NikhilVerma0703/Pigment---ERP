// Searching: the four subsections and the filters each one accepts. Shared by
// the page, the filter bar and the Excel export route, so a download always
// contains exactly what the screen shows. Filters live in the URL
// (?tab=…&name=…&from=…), which makes a search reloadable and shareable.

export const SEARCH_TABS = [
  { value: "formulas", label: "Formula Search" },
  { value: "production", label: "Daily Production Search" },
  { value: "pigments", label: "Stock & Pigment Consumption" },
  { value: "materials", label: "Materials Consumption" },
] as const;

export type SearchTab = (typeof SEARCH_TABS)[number]["value"];

export const FILTER_KEYS: Record<SearchTab, readonly string[]> = {
  formulas: ["name", "type", "material", "from", "to"],
  production: ["batch", "loc", "design", "pigment", "from", "to"],
  pigments: ["pigment", "batch", "loc", "from", "to"],
  materials: ["material", "batch", "loc", "mixer", "from", "to"],
};

export type Filters = Record<string, string>;

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

function read(params: Params, key: string): string {
  const v = params instanceof URLSearchParams ? params.get(key) : params[key];
  return (Array.isArray(v) ? v[0] : v ?? "").trim();
}

export function parseTab(params: Params): SearchTab {
  const t = read(params, "tab");
  return SEARCH_TABS.some((s) => s.value === t) ? (t as SearchTab) : "formulas";
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The tab's filters from the URL: known keys only, trimmed, empty dropped,
 *  dates that are not yyyy-mm-dd dropped. */
export function parseFilters(tab: SearchTab, params: Params): Filters {
  const out: Filters = {};
  for (const key of FILTER_KEYS[tab]) {
    const v = read(params, key).slice(0, 120);
    if (!v) continue;
    if ((key === "from" || key === "to") && !DATE_RE.test(v)) continue;
    out[key] = v;
  }
  return out;
}

export function filtersToQuery(tab: SearchTab, filters: Filters): string {
  const q = new URLSearchParams({ tab });
  for (const key of FILTER_KEYS[tab]) if (filters[key]?.trim()) q.set(key, filters[key].trim());
  return q.toString();
}
