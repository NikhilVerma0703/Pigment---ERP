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

## Stocks and Consumption rules (`src/lib/stock/consumption.ts`)

- Only pigments/colours on the stock list have stock. Total Stock = the sum of their "+ Add"
  entries (stored as entered and in kg). Adding an existing name adds to its stock.
- Consumption is computed live from the saved records, not stored, so it always matches them:
  - Formula Creation: each row's Required Quantity, on the formula's date.
  - Daily Production: "Quantity Used" is per cycle — quantity × total cycles; with a cycle-time
    change, each range counts quantity × (To − From + 1), and cycles no range covers use the
    base pigment rows.
- Remaining = Total Stock − Consumed (can go negative: shown as "Short").
- Materials (Grit, Powder, Resin, …) are consumption only, taken as entered (a total, not per
  cycle), shown per production date and cumulatively.
- Everything is converted to kg (gm ÷ 1000). Names match case-insensitively.

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
- Recent Pigment Packing Details: latest 10 by production date then creation time; a row opens
  the full record.

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
