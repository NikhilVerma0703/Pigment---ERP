"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, FormProvider, useForm, useWatch, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { saveProduction } from "@/app/pigment-packing/actions";
import { emptyPigment } from "@/components/production/PigmentTable";
import { MixerSection } from "@/components/production/MixerSection";
import { defaultMaterials } from "@/components/production/MaterialsConsumption";
import { EditBanner } from "@/components/ui/EditBanner";
import { SuggestCombobox } from "@/components/ui/SuggestCombobox";
import { MAX_REGULAR_MIXERS, MIXER_SLOTS, ROYMIX_INDEX, ROYMIX_LABEL } from "@/lib/production/constants";
import type { ProductionSuggestions } from "@/lib/production/queries";
import { activeMixerSlots, productionInputSchema, type ProductionInput } from "@/lib/production/schema";

function defaults(serialNo: number, date = format(new Date(), "yyyy-MM-dd")): ProductionInput {
  return {
    date,
    serialNo: String(serialNo),
    batchNumber: "",
    locNumber: "",
    designName: "",
    totalCycles: "",
    // "" until entered; the mixer sections open then.
    mixersUsed: "",
    roymixUsed: "NO",
    // Every slot exists from the start (regular 1 … MAX, then Roymix); only
    // the active ones are shown, validated and saved.
    mixers: Array.from({ length: MIXER_SLOTS }, () => ({
      pigments: [emptyPigment()],
      cycleTimeChanged: "NO",
      changeCount: "",
      changes: [],
      materials: defaultMaterials(),
    })),
  };
}

const TEXT_FIELDS = [
  { name: "batchNumber", label: "Batch Number", key: "batchNumbers" },
  { name: "locNumber", label: "LOC Number", key: "locNumbers" },
  { name: "designName", label: "Production Name/Design Name", key: "designNames" },
] as const;

export function ProductionForm({
  suggestions,
  nextSerialNo,
  editing,
}: {
  suggestions: ProductionSuggestions;
  nextSerialNo: number;
  /** A saved record opened with Edit: the form starts with its values and
   *  saving updates that record. */
  editing?: { id: string; serialNo: number; batchNumber: string; values: ProductionInput };
}) {
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const materialSuggestions = {
    others: suggestions.otherMaterials,
    names: suggestions.materialNames,
    colors: suggestions.materialColors,
  };

  const methods = useForm<ProductionInput>({
    resolver: zodResolver(productionInputSchema),
    defaultValues: editing?.values ?? defaults(nextSerialNo),
    mode: "onTouched",
  });
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    getValues,
    formState: { errors },
  } = methods;

  // Mixer 1 … Mixer N, plus the Roymix Mixer when Roymix Used is Yes.
  const mixersRaw = (useWatch({ control, name: "mixersUsed" }) ?? "").trim();
  const roymixUsed = useWatch({ control, name: "roymixUsed" });
  const countValid = /^\d+$/.test(mixersRaw) && Number(mixersRaw) <= MAX_REGULAR_MIXERS;
  const slots = countValid ? activeMixerSlots(mixersRaw, roymixUsed) : [];

  const onSubmit = (values: ProductionInput) =>
    startSaving(async () => {
      const result = await saveProduction(values, editing?.id);
      if (!result.ok) {
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          setError(field as FieldPath<ProductionInput>, { type: "server", message });
        }
        toast.error(result.error);
        return;
      }
      if (editing) {
        toast.success(`Daily production updated (S.No. ${result.serialNo})`);
        router.replace("/pigment-packing", { scroll: false });
        router.refresh();
        return;
      }
      toast.success(`Daily production saved (S.No. ${result.serialNo})`);
      reset(defaults(result.serialNo + 1, getValues("date")));
      window.scrollTo({ top: 0, behavior: "smooth" });
      router.refresh();
    });

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={handleSubmit(onSubmit, () => toast.error("Please correct the highlighted fields."))}
        // Enter in a field must not save a half-entered record; only the button does.
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault();
        }}
        className="mx-auto max-w-5xl space-y-6"
        noValidate
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-pacific-dark md:text-3xl">Daily Production</h1>
          <p className="mt-1 text-sm text-gray-600">Pigment Packing Details</p>
        </div>

        {editing && (
          <EditBanner label={`batch ${editing.batchNumber} (S.No. ${editing.serialNo})`} cancelHref="/pigment-packing" />
        )}

        {/* 1. Basic production details */}
        <section className="card p-5">
          <h2 className="mb-4 text-base font-semibold text-pacific-dark">Basic Production Details</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="date" className="field-label">Date</label>
              <input id="date" type="date" className="field-input" aria-invalid={!!errors.date || undefined} {...register("date")} />
              {errors.date && <p className="field-error">{errors.date.message}</p>}
            </div>
            <div>
              <label htmlFor="serialNo" className="field-label">S.No.</label>
              <input
                id="serialNo"
                type="text"
                inputMode="numeric"
                className="field-input"
                aria-invalid={!!errors.serialNo || undefined}
                {...register("serialNo")}
              />
              {errors.serialNo && <p className="field-error">{errors.serialNo.message}</p>}
            </div>
            {TEXT_FIELDS.map((f) => (
              <div key={f.name}>
                <label htmlFor={f.name} className="field-label">{f.label}</label>
                <Controller
                  control={control}
                  name={f.name}
                  render={({ field }) => (
                    <SuggestCombobox
                      id={f.name}
                      ref={field.ref}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      suggestions={suggestions[f.key]}
                      invalid={!!errors[f.name]}
                      newLabel="New entry"
                    />
                  )}
                />
                {errors[f.name] && <p className="field-error">{errors[f.name]?.message}</p>}
              </div>
            ))}
            <div>
              <label htmlFor="totalCycles" className="field-label">Total Number of Cycles Running</label>
              <input
                id="totalCycles"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="e.g. 30"
                className="field-input tabular-nums"
                aria-invalid={!!errors.totalCycles || undefined}
                {...register("totalCycles")}
              />
              {errors.totalCycles && <p className="field-error">{errors.totalCycles.message}</p>}
            </div>
            <div>
              <label htmlFor="mixersUsed" className="field-label">Number of Mixers Used</label>
              <input
                id="mixersUsed"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="e.g. 4"
                className="field-input tabular-nums"
                aria-invalid={!!errors.mixersUsed || undefined}
                {...register("mixersUsed")}
              />
              {errors.mixersUsed && <p className="field-error">{errors.mixersUsed.message}</p>}
            </div>
            <div>
              <label htmlFor="roymixUsed" className="field-label">Roymix Used</label>
              <select id="roymixUsed" className="field-input" {...register("roymixUsed")}>
                <option value="NO">No</option>
                <option value="YES">Yes</option>
              </select>
            </div>
          </div>
        </section>

        {/* 2. Mixers */}
        {slots.length === 0 ? (
          <div className="card border-dashed px-6 py-10 text-center text-sm text-gray-500">
            {mixersRaw === "" ? (
              <>Enter the <span className="font-semibold text-gray-700">Number of Mixers Used</span> to open the mixer sections.</>
            ) : !countValid ? (
              <>Number of Mixers Used must be from 0 to {MAX_REGULAR_MIXERS}.</>
            ) : (
              <>Enter at least 1 mixer, or set <span className="font-semibold text-gray-700">Roymix Used</span> to Yes.</>
            )}
          </div>
        ) : (
          slots.map((i) => (
            <MixerSection
              key={i}
              index={i}
              label={i === ROYMIX_INDEX ? ROYMIX_LABEL : `Mixer ${i + 1}`}
              pigmentSuggestions={suggestions.pigments}
              materialSuggestions={materialSuggestions}
            />
          ))
        )}

        {/* 3. Save */}
        {slots.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              className="btn-secondary"
              disabled={saving}
              onClick={() => reset(editing ? editing.values : defaults(nextSerialNo, getValues("date")))}
            >
              <RotateCcw className="h-4 w-4" /> {editing ? "Discard changes" : "Clear"}
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : editing ? "Update Production Record" : "Save Production Record"}
            </button>
          </div>
        )}
      </form>
    </FormProvider>
  );
}
