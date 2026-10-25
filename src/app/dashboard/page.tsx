import type { Metadata } from "next";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Boxes, ClipboardList, Droplets, FlaskConical, Package, Palette, PaintBucket, Scale, Sparkles } from "lucide-react";
import { KgList, KpiCard, NameList } from "@/components/dashboard/KpiCard";
import { RecentProductionTable } from "@/components/dashboard/RecentProductionTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { getDashboardData } from "@/lib/dashboard/queries";
import { formatQty } from "@/lib/formula/calc";

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

export default async function DashboardPage() {
  const { today, overall, daily, recent } = await getDashboardData();
  const todayLabel = format(parseISO(today), "EEEE, dd MMM yyyy");
  const newCount = daily.newPigments.length;

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" description={todayLabel} />

      {/* 1. Overall summary — all-time */}
      <section>
        <SectionTitle aside="All-time">Overall Summary</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={Palette} label="Total Pigments / Colors" value={overall.pigments} hint="On the stock list" />
          <KpiCard icon={Package} label="Total Production Records" value={overall.productionRecords} hint="Daily Production records" />
          <KpiCard icon={FlaskConical} label="Total Formulas Created" value={overall.formulas} hint="From Formula Creation" />
          <KpiCard
            icon={Scale}
            label="Total Stock Remaining"
            value={formatQty(overall.remainingKg)}
            unit="kg"
            hint={<Link href="/stocks-consumption" className="hover:text-brand-700 hover:underline">All pigments/colors, after consumption</Link>}
          />
        </div>
      </section>

      {/* 2. Today's summary */}
      <section>
        <SectionTitle aside={todayLabel}>Today&apos;s Summary</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard
            compact
            icon={Sparkles}
            label="Today's New Pigments / Colors"
            value={newCount}
            hint={newCount === 0 ? "None added to stock today" : `New to the stock list`}
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
          <KpiCard compact icon={ClipboardList} label="Today's Production Records" value={daily.productionRecords} hint="Daily Production records dated today" />
          <KpiCard compact icon={Droplets} label="Today's Pigment Consumption" value={formatQty(daily.pigmentKg)} unit="kg">
            <KgList items={daily.pigments} empty="No pigment consumed today." />
          </KpiCard>
          <KpiCard compact icon={PaintBucket} label="Today's Formulas Created" value={daily.formulas} hint="Formulas dated today" />
          <KpiCard compact icon={Boxes} label="Today's Materials Consumption" value={formatQty(daily.materialKg)} unit="kg">
            <KgList items={daily.materials} empty="No materials consumed today." />
          </KpiCard>
        </div>
      </section>

      {/* 3. Recent pigment packing details */}
      <section className="card p-5">
        <SectionTitle aside="Latest 10 · click a row to open the full record">Recent Pigment Packing Details</SectionTitle>
        <RecentProductionTable rows={recent} />
      </section>
    </div>
  );
}
