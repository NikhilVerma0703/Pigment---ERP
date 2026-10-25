import type { Metadata } from "next";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Download, Factory, Scale } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { DownloadForm } from "@/components/reports/DownloadForm";
import { ConsumptionView, ProductionSummaryView, ReportRangeFilter } from "@/components/reports/ReportViews";
import { monthOptions, parseReportRange, parseReportTab, REPORT_TABS, type ReportTab } from "@/lib/reports/period";
import { getConsumptionReport, getProductionSummary } from "@/lib/reports/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports and Downloads" };

// Reports are built from the saved records on every request.
export const dynamic = "force-dynamic";

const TAB_ICONS: Record<ReportTab, typeof Factory> = { production: Factory, consumption: Scale, downloads: Download };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tab = parseReportTab(params);
  const { from, to, group } = parseReportRange(params);
  const label = (d: string) => format(parseISO(d), "dd MMM yyyy");
  const rangeLabel = from === to ? label(from) : `${label(from)} – ${label(to)}`;

  let body: React.ReactNode;
  if (tab === "production") {
    const summary = await getProductionSummary(from, to, group);
    body = (
      <>
        <ReportRangeFilter key={`${from}${to}${group}`} tab={tab} from={from} to={to} group={group} />
        <ProductionSummaryView summary={summary} rangeLabel={rangeLabel} />
      </>
    );
  } else if (tab === "consumption") {
    const report = await getConsumptionReport(from, to);
    body = (
      <>
        <ReportRangeFilter key={`${from}${to}`} tab={tab} from={from} to={to} />
        <ConsumptionView report={report} rangeLabel={rangeLabel} />
      </>
    );
  } else {
    body = <DownloadForm months={monthOptions()} />;
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Reports and Downloads" description="Production and consumption summaries from the saved records, and Excel downloads." />

      <nav className="flex flex-wrap gap-2" aria-label="Report sections">
        {REPORT_TABS.map((t, i) => {
          const Icon = TAB_ICONS[t.value];
          const active = t.value === tab;
          return (
            <Link
              key={t.value}
              href={`/reports?tab=${t.value}`}
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

      {tab !== "downloads" && <p className="text-sm text-gray-600">Showing {rangeLabel}.</p>}
      {body}
    </div>
  );
}
