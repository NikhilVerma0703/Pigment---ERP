import type { Metadata } from "next";
import { ProductionForm } from "@/components/production/ProductionForm";
import { getNextProductionSerialNo, getProductionSuggestions } from "@/lib/production/queries";

export const metadata: Metadata = { title: "Daily Production" };

// Suggestions and the next S.No. change with every save.
export const dynamic = "force-dynamic";

export default async function PigmentPackingPage() {
  const [suggestions, nextSerialNo] = await Promise.all([getProductionSuggestions(), getNextProductionSerialNo()]);
  return <ProductionForm suggestions={suggestions} nextSerialNo={nextSerialNo} />;
}
