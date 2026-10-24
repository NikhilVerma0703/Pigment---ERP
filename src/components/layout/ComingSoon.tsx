import { Construction } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

export function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <Construction className="h-10 w-10 text-brand-400" aria-hidden />
        <p className="text-base font-semibold text-gray-800">This section is coming soon</p>
        <p className="max-w-md text-sm text-gray-500">
          {title} will be built in a later phase of the Pigment ERP.
        </p>
      </div>
    </>
  );
}
