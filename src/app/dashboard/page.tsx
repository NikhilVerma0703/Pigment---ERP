import type { Metadata } from "next";
import { format, parseISO } from "date-fns";
import { Boxes, ClipboardList, Droplets, FlaskConical, Package, Palette, PaintBucket, Scale, Sparkles } from "lucide-react";
import { KgList, KpiCard, NameList } from "@/components/dashboard/KpiCard";
import { PigmentDetailsSearch } from "@/components/dashboard/PigmentDetailsSearch";
import { BatchSearch } from "@/components/dashboard/BatchSearch";
import { PageHeader } from "@/components/layout/PageHeader";
import { getDashboardData } from "@/lib/dashboard/queries";
import { formatQty } from "@/lib/formula/calc";
import { buildBatchReport } from "@/lib/reports/batch";
import { getProductionDetail } from "@/lib/search/queries";
import { BatchReportView } from "@/components/reports/BatchReportView";

export const metadata: Metadata = { title: "Dashboard" };

// Every figure is read from the saved records on each visit.
export const dynamic = "force-dynamic";

function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-base font-semibold text-pacific-dark">{children}</h2>
      {aside && <span className="text-xs text-gray-500">{aside}</span>}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const batchParam = sp.batch;
  const pigmentParam = typeof sp.pigment === "string" ? sp.pigment.slice(0, 120) : undefined;
  const batchId = typeof batchParam === "string" && batchParam.length <= 64 ? batchParam : undefined;
  const [{ today, overall, daily, pigmentNames, pigmentDetail, batchOptions }, batchDetail] = await Promise.all([
    getDashboardData(pigmentParam),
    batchId ? getProductionDetail(batchId) : Promise.resolve(null),
  ]);
  const batchReport = batchDetail ? buildBatchReport(batchDetail) : null;
  const todayLabel = format(parseISO(today), "EEEE, dd MMM yyyy");
  const newCount = daily.newPigments.length;

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" description={todayLabel} />

      {/* 1. Overall summary — all-time */}
      <section>
        <SectionTitle>Overall Summary</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={Palette} label="Total Pigments / Colors" value={overall.pigments} />
          <KpiCard icon={Package} label="Total Production Records" value={overall.productionRecords} />
          <KpiCard icon={FlaskConical} label="Total Formulas Created" value={overall.formulas} />
          <KpiCard
            icon={Scale}
            label="Total Stock Remaining"
            value={formatQty(overall.remainingKg)}
            unit="kg"
          />
        </div>
      </section>

      {/* 2. Today's summary */}
      <section>
        <SectionTitle>Today&apos;s Summary</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard
            compact
            icon={Sparkles}
            label="Today's New Pigments / Colors"
            value={newCount}
          >
            {newCount === 0 && daily.restockedPigments.length === 0 ? (
              <p className="text-xs text-gray-400">No stock added today.</p>
            ) : (
              <div className="space-y-1">
                <NameList label="New" names={daily.newPigments} tone="new" />
                <NameList label="Restocked (existing)" names={daily.restockedPigments} tone="existing" />
              </div>
            )}
          </KpiCard>
          <KpiCard compact icon={ClipboardList} label="Today's Production Records" value={daily.productionRecords} />
          <KpiCard compact icon={Droplets} label="Today's Pigment Consumption" value={formatQty(daily.pigmentKg)} unit="kg">
            <KgList items={daily.pigments} empty="No pigment consumed today." />
          </KpiCard>
          <KpiCard compact icon={PaintBucket} label="Today's Formulas Created" value={daily.formulas} />
          <KpiCard compact icon={Boxes} label="Today's Materials Consumption" value={formatQty(daily.materialKg)} unit="kg">
            <KgList items={daily.materials} empty="No materials consumed today." />
          </KpiCard>
        </div>
      </section>

      {/* 3. Batch details report for the selected batch */}
      <section className="card p-5">
        <SectionTitle aside={batchReport ? `S.No. ${batchReport.serialNo}` : undefined}>
          Batch Details Report{batchReport ? ` — ${batchReport.batchNumber}` : ""}
        </SectionTitle>
        <BatchSearch options={batchOptions} selectedId={batchReport?.id} />
        {batchReport ? (
          <BatchReportView report={batchReport} scrollIntoView />
        ) : (
          <p className="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
            {batchId
              ? "That batch no longer exists."
              : "Search a Batch Number above to see its full report here."}
          </p>
        )}
      </section>

      {/* 4. Pigment details search */}
      <section className="card p-5">
        <SectionTitle>Pigment Details Search</SectionTitle>
        <PigmentDetailsSearch names={pigmentNames} detail={pigmentDetail} />
      </section>
    </div>
  );
}
