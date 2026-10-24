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
src/components/layout/      Sidebar, nav-items, PageHeader, ComingSoon
src/components/ui/          SuggestCombobox — free-text input with suggestions
src/components/formula/     FormulaForm, RequirementTable
src/components/stock/       StockEntryForm, StockOverview (palette + live table),
                            MaterialsConsumption, ConsumptionCharts (Recharts)
src/components/production/  ProductionForm, MixerSection (pigments, cycle changes,
                            materials), PigmentTable
src/lib/formula/            calc.ts (Requirement Table maths), schema.ts (zod),
                            queries.ts (suggestions, next S.No.), constants.ts
src/lib/production/         schema.ts (zod + cycle-range rules), queries.ts, constants.ts
src/lib/stock/              consumption.ts (pure rules), queries.ts (page data), schema.ts
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
