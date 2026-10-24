import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { FormulaForm } from "@/components/formula/FormulaForm";
import { getMaterialSuggestions, getNextSerialNo } from "@/lib/formula/queries";

export const metadata: Metadata = { title: "Formula Creation" };

// Suggestions and the next S.No. change with every save.
export const dynamic = "force-dynamic";

export default async function FormulaCreationPage() {
  const [suggestions, nextSerialNo] = await Promise.all([getMaterialSuggestions(), getNextSerialNo()]);
  return (
    <>
      <PageHeader
        title="Formula Creation"
        description="Create a pigment formula, scale it to the required quantity and save it for future use."
      />
      <FormulaForm suggestions={suggestions} nextSerialNo={nextSerialNo} />
    </>
  );
}
