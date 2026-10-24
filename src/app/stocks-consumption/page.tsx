import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConsumptionTrendChart, MostConsumedChart, StockComparisonChart } from "@/components/stock/ConsumptionCharts";
import { MaterialsConsumption } from "@/components/stock/MaterialsConsumption";
import { StockEntryForm } from "@/components/stock/StockEntryForm";
import { StockPalette, StockTable, UntrackedNotice } from "@/components/stock/StockOverview";
import { AnalyticsRangeSelect } from "@/components/stock/AnalyticsRangeSelect";
import { parseAnalyticsRange } from "@/lib/stock/constants";
import { getStockPageData } from "@/lib/stock/queries";

export const metadata: Metadata = { title: "Stocks and Consumption" };

// Stock and consumption are computed from the saved records on every request.
export const dynamic = "force-dynamic";

export default async function StocksConsumptionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const range = parseAnalyticsRange((await searchParams).range);
  const data = await getStockPageData(range);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stocks and Consumption"
        description="Pigment/color stock is deducted automatically by Formula Creation and Daily Production. Materials show consumption only."
      />

      {/* 1. Pigment/Color stock */}
      <section className="card p-5">
        <h2 className="text-base font-semibold text-pacific-dark">Stock</h2>
        <p className="mb-4 mt-0.5 text-sm text-gray-600">
          Add pigments/colors and their available quantity. Adding a name that is already listed adds to its stock.
        </p>
        <StockEntryForm suggestions={data.pigmentSuggestions} />

        <h3 className="mb-3 mt-8 text-sm font-semibold text-gray-800">Live Stock</h3>
        {data.stocks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
            No pigment stock yet. Add pigments above to start tracking.
          </p>
        ) : (
          <>
            <StockPalette stocks={data.stocks} />
            <div className="mt-4">
              <StockTable stocks={data.stocks} />
            </div>
          </>
        )}
        <UntrackedNotice untracked={data.untracked} />
        <p className="mt-3 text-xs text-gray-500">
          All figures in kg. Formulas consume each row&apos;s Required Quantity; Daily Production consumes the per-cycle
          quantity × the cycles it ran.
        </p>
      </section>

      {/* 2. Materials — consumption only */}
      <section className="card p-5">
        <h2 className="text-base font-semibold text-pacific-dark">Materials Used Consumption</h2>
        <p className="mb-4 mt-0.5 text-sm text-gray-600">
          From saved Daily Production records. Consumption only — no stock is kept for materials.
        </p>
        <MaterialsConsumption data={data.materials} />
      </section>

      {/* 3. Analytics */}
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <AnalyticsRangeSelect value={range} />
          <h2 className="text-base font-semibold text-pacific-dark">Consumption Analytics</h2>
        </div>
        <div className="space-y-6">
          <StockComparisonChart stocks={data.stocks} rangeDays={data.rangeDays} />
          <div className="grid gap-6 xl:grid-cols-2">
            <ConsumptionTrendChart trend={data.trend} />
            <MostConsumedChart pigments={data.topPigments} materials={data.topMaterials} rangeDays={data.rangeDays} />
          </div>
        </div>
      </div>
    </div>
  );
}
