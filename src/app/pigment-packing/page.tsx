import type { Metadata } from "next";
import { ProductionForm } from "@/components/production/ProductionForm";
import { RecentProductionTable } from "@/components/production/RecentProductionTable";
import { getProductionForEdit } from "@/lib/production/edit";
import { getNextProductionSerialNo, getProductionSuggestions, getRecentProduction } from "@/lib/production/queries";

export const metadata: Metadata = { title: "Daily Production" };

// Suggestions, the next S.No. and the recent records change with every save;
// the form refreshes the page after a save, so the table updates at once.
export const dynamic = "force-dynamic";

export default async function PigmentPackingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const edit = (await searchParams).edit;
  const editId = typeof edit === "string" ? edit : undefined;
  const [suggestions, nextSerialNo, recent, editing] = await Promise.all([
    getProductionSuggestions(),
    getNextProductionSerialNo(),
    getRecentProduction(10),
    editId ? getProductionForEdit(editId) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-8">
      {editId && !editing && (
        <p className="mx-auto max-w-5xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          That production record no longer exists, so a new record is shown instead.
        </p>
      )}
      {/* Keyed by the record being edited, so opening another one restarts the form with its values. */}
      <ProductionForm key={editing?.id ?? "new"} suggestions={suggestions} nextSerialNo={nextSerialNo} editing={editing ?? undefined} />

      <section className="card mx-auto max-w-5xl p-5">
        <h2 className="mb-3 text-base font-semibold text-pacific-dark">Recent Pigment Packing Details</h2>
        <RecentProductionTable rows={recent} editingId={editing?.id} />
      </section>
    </div>
  );
}
