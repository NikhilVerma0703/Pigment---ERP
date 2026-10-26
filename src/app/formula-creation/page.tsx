import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { FormulaForm } from "@/components/formula/FormulaForm";
import { LatestFormulasTable } from "@/components/formula/LatestFormulasTable";
import { getFormulaForEdit } from "@/lib/formula/edit";
import { getLatestFormulas, getMaterialSuggestions, getNextSerialNo } from "@/lib/formula/queries";

export const metadata: Metadata = { title: "Formula Creation" };

// Suggestions, the next S.No. and the latest formulas change with every save;
// the form refreshes the page after a save, so the table updates at once.
export const dynamic = "force-dynamic";

export default async function FormulaCreationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const edit = (await searchParams).edit;
  const editId = typeof edit === "string" ? edit : undefined;
  const [suggestions, nextSerialNo, latest, editing] = await Promise.all([
    getMaterialSuggestions(),
    getNextSerialNo(),
    getLatestFormulas(10),
    editId ? getFormulaForEdit(editId) : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader title="Formula Creation" />
      {editId && !editing && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          That formula no longer exists, so a new formula is shown instead.
        </p>
      )}
      {/* Keyed by the record being edited, so opening another one restarts the form with its values. */}
      <FormulaForm key={editing?.id ?? "new"} suggestions={suggestions} nextSerialNo={nextSerialNo} editing={editing ?? undefined} />

      <section className="card mt-8 p-5">
        <h2 className="mb-3 text-base font-semibold text-pacific-dark">Latest 10 Formula Entries</h2>
        <LatestFormulasTable rows={latest} editingId={editing?.id} />
      </section>
    </>
  );
}
