# Pigment ERP

ERP for the Pigment Department (quartz, slabs and tiles manufacturing).
Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS 3 + Prisma 6 + PostgreSQL
(Neon in production). Same stack and conventions as Pacific ERP. No authentication yet.

## Commands

```bash
npm run dev          # next dev
npm run build        # prisma generate && next build
npm run typecheck    # tsc --noEmit
npm run db:migrate   # prisma migrate dev — local database
npm run db:studio    # browse the database
```

Production (Neon): set `DATABASE_URL` (pooled) and `DIRECT_URL` (direct), then
`npx prisma migrate deploy`. See `.env.example`.

## Layout

```
src/app/                    routes — one folder per sidebar section
  formula-creation/         page.tsx (server) + actions.ts (saveFormula server action)
  pigment-packing/          Daily Production: page.tsx + actions.ts (saveProduction)
  stocks-consumption/       page.tsx + actions.ts (saveStock)
  searching/                page.tsx (four tabs) + actions.ts (fetchDetail)
  api/search/export/        GET → filtered results as .xlsx
  reports/                  page.tsx (three tabs)
  api/reports/download/     GET → report .xlsx for a type and period
src/components/layout/      Sidebar, nav-items, PageHeader, ComingSoon
src/components/ui/          SuggestCombobox — free-text input with suggestions
src/components/search/      SearchFilters, DataTable, RecordDetail, SearchResults
src/components/formula/     FormulaForm, RequirementTable
src/components/stock/       StockEntryForm, StockOverview (palette + live table),
                            MaterialsConsumption, ConsumptionCharts (Recharts)
src/components/production/  ProductionForm, MixerSection (pigments, cycle changes,
                            materials), PigmentTable
src/lib/formula/            calc.ts (Requirement Table maths), schema.ts (zod),
                            queries.ts (suggestions, next S.No.), constants.ts
src/lib/production/         schema.ts (zod + cycle-range rules), queries.ts, constants.ts
src/lib/stock/              consumption.ts (pure rules), queries.ts (page data), schema.ts
src/lib/search/             filters.ts, queries.ts, export.ts (exceljs), types.ts
src/lib/reports/            period.ts (periods, validation), queries.ts (summaries)
prisma/                     schema.prisma + migrations/
```

## Formula Creation — calculation rules (`src/lib/formula/calc.ts`)

- Total Quantity Used (kg) = Σ kg quantities + Σ gm quantities ÷ 1000 (kept to 6 dp, shown to 3).
- Consumption Rate = Total Quantity Required ÷ Total Quantity Used, rounded to 3 dp.
- Required quantity per material = its quantity × the rounded rate, in its own unit, 3 dp.
- The server recomputes all of this on save; the browser's numbers are never stored.
- A material row whose name matches a saved formula is stored as a link to that formula;
  any other name becomes (or reuses) a Material.

## Pigment Packing Details — Daily Production rules

- "Number of Mixers Used" N shows the first N of Mixer-1, Mixer-2, Roymix Mixer. The form
  keeps all three while editing; only the first N are validated and saved.
- Cycle changes: entering "How Many Times It Changed" generates that many entries, each
  prefilled with a copy of the mixer's pigment rows (independent afterwards). The first
  starts at cycle 1, the last ends at the total cycles, and typing a "To" starts the next
  range on the following cycle. Ranges must be ascending, non-overlapping and within the
  total; each needs at least one pigment.
- Blank rows are not saved: an untouched pigment row, a standard material with no
  quantity, an empty "+ Add/Others" row.
- A pigment whose name matches a saved formula is linked to it (`formula_id`).

## Stocks and Consumption rules (`src/lib/stock/consumption.ts`, `loadPigmentLedger`)

- Stock is kept for pigments/colours and formulas only (materials are consumption-only).
- Total Stock = Initial stock + Manual additions (± adjustments) + Formula production.
  - Manual movements are `pigment_stock_entries` rows: INITIAL (a pigment's first quantity),
    ADDITION, ADJUSTMENT (signed). The Live Stock table's Adjust writes a new row; nothing is
    overwritten.
  - Formula Creation adds stock: every saved formula adds its Total Quantity Required to its own
    name's stock (a stock row is created on first save). The same formula name can be saved again
    for each new production. Its ingredients are not deducted.
- Total Consumed = Daily Production only (per-cycle quantity × cycles run, as before).
- Remaining = Total Stock − Total Consumed (negative shows as Short).
- Formula production and consumption are read from their own records, never copied into stock
  rows, so re-reading or re-saving can never add or deduct twice.
- Transaction history: Searching → Stock & Pigment Consumption (also the History link on each
  Live Stock row), with the running balance after each transaction.
- Dashboard → Pigment Details Search: current stock plus the latest formula saved under the name.

## Searching (`src/lib/search`)

- Four tabs (`/searching?tab=formulas|production|pigments|materials`); filters live in the URL,
  so a search can be reloaded or shared. Text filters are partial, case-insensitive matches.
- Every result opens the complete saved record (formula or production) in a detail view.
- "Download Excel" (`/api/search/export`) runs the same search with the applied filters and
  writes a detailed workbook: a summary sheet, line-level sheets and a Filters sheet.
- Stock & Pigment Consumption: the running balance is computed over each pigment's whole
  history before filters are applied, so a filtered row still shows the true balance then.
  Formula rows count only for pigments on the stock list (other ingredients, e.g. Resin, are
  not pigments). A Batch/LOC filter shows production transactions only.
- Materials: consumption only; cumulative totals run per material within the results.

## Dashboard (`src/lib/dashboard/queries.ts`)

- Overall: pigments on the stock list, production records, formulas, and total remaining stock
  (the same figure as Stocks and Consumption — both read `loadPigmentLedger`).
- Today (server date): records, formulas and consumption by the date entered on the record;
  "new" pigments are those first added to the stock list today, listed apart from existing
  pigments that were restocked today.

## Low Stock Alerts (`src/lib/stock/alerts.ts`)

- Pigments/colours only. Out of Stock: remaining ≤ 0. Low Stock: a Minimum Stock Level (kg,
  `pigment_stocks.min_stock_kg`) is set and remaining ≤ it. The minimum is edited in the table.

## Reports and Downloads (`src/lib/reports`)

- `/reports?tab=production|consumption|downloads`; range in the URL (`from`, `to`, and `group`
  = daily|weekly|monthly for production). Default range: this month up to today.
- Production Summary: per period — records, distinct batches, cycles, cycles per mixer, cycle
  changes, pigment and material kg; a mixer-wise table; every cycle-change range.
- Consumption & Cost: production-wise pigment and material consumption with totals. Rate and
  Cost columns are placeholders until rates exist.
- Downloads: `GET /api/reports/download?type=formulas|production|stock&period=today|custom|month`
  (+ `from`/`to` or `month=yyyy-mm`). 400 with a message for invalid input, 404 when the period
  has no records. Workbooks reuse the sheet writers in `src/lib/search/export.ts`.

## Materials Consumption entries (`src/lib/production/materials.ts`)

- Each mixer records any number of entries per material. Grit and Powder: size (presets or
  "+ Others"), name, colour. Resin: name. Catalyst / Cobalt / Silane: name and percentage; their
  quantity is calculated: percent / 100 × the mixer's total resin (kg), shown in the entry's unit.
  "+ Others" adds custom materials. Names and colours are suggested from earlier records.
- Stored in `production_materials` (`category`, `size`, `item_name`, `color`, `percent`); `name`
  stays the material name, so totals and reports group by it. Consumption only — no stock.

## Batch Details Report (`src/lib/reports/batch.ts`)

- Built from one production record: basic info; Materials Consumption (a row per material, Grit
  and Powder a row per size, a column per mixer, total); Pigment Details (a row per mixer, the
  original pigments, a column per cycle range when the cycle time changed).
- Dashboard: use "Search Batch Number" (every saved record; a repeated batch number is shown with
  its date and S.No.) or click a Batch Number in Recent Pigment Packing Details (`/dashboard?batch=<id>`).
  Searching: a Daily Production result opens `/searching/batch/<id>` (Back to Search, Print).
- Exports: Excel `GET /api/batch-report/<id>`; PDF generated in the browser (jsPDF).

## Recent entries tables

- Pigment Packing Details: "Recent Pigment Packing Details" below the form — the latest 10
  production records (production date, then save time, newest first). A row opens the full
  record; the Batch Number opens its Batch Details Report on the Dashboard.
- Formula Creation: "Latest 10 Formula Entries" below the form; a row opens the full formula.
- Both pages refresh after a successful save, so the tables update immediately.

## Review, Edit and Delete (recent-entries tables)

- Review: read-only overview of every saved field (the same detail view as Searching).
- Edit: `?edit=<id>` reopens the page's form with the record's values; saving calls the same
  save action with the id, which updates that record in place (rows/mixers are replaced) — no
  duplicates. Stock, consumption and reports follow automatically (they are read from records).
- Delete: asks "Do you want to permanently delete this record?". A production record is removed
  with all its rows. A formula's references are re-pointed to the latest other formula of the same
  name (or, if none, the ingredient becomes a plain material and production rows keep the name);
  its stock row is removed only when nothing else uses it.
