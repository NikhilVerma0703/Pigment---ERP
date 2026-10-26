import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { BatchReportView } from "@/components/reports/BatchReportView";
import { buildBatchReport } from "@/lib/reports/batch";
import { getProductionDetail } from "@/lib/search/queries";

export const metadata: Metadata = { title: "Batch Details Report" };

// Always the record as it is saved now.
export const dynamic = "force-dynamic";

/** Only a Searching query string is accepted as the way back. */
function backHref(back: string | string[] | undefined): string {
  const q = Array.isArray(back) ? back[0] : back;
  return q && /^tab=[\w-]+(&[\w%.+-]+=[^&]*)*$/.test(q) ? `/searching?${q}` : "/searching?tab=production";
}

export default async function BatchReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const detail = id.length <= 64 ? await getProductionDetail(id) : null;
  if (!detail) notFound();
  const report = buildBatchReport(detail);

  return (
    <div className="space-y-5">
      <PageHeader title="Batch Details Report" description={`Batch ${report.batchNumber} · Daily Production S.No. ${report.serialNo}`} />
      <div className="card p-5">
        <BatchReportView report={report} backHref={backHref((await searchParams).back)} showPrint />
      </div>
    </div>
  );
}
