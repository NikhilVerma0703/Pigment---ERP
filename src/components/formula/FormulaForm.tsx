"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveFormula } from "@/app/formula-creation/actions";
import { EditBanner } from "@/components/ui/EditBanner";
import { SuggestCombobox } from "@/components/ui/SuggestCombobox";
import { RequirementTable } from "@/components/formula/RequirementTable";
import { calculateRequirement, type CalcItem } from "@/lib/formula/calc";
import { FORMULA_TYPE_OPTIONS, UNIT_OPTIONS } from "@/lib/formula/constants";
import type { Suggestion } from "@/lib/suggestions";
import { formulaInputSchema, type FormulaInput } from "@/lib/formula/schema";
import { nameKey } from "@/lib/utils";

const emptyItem = (): FormulaInput["items"][number] => ({ name: "", unit: "KG", quantity: "" });

function defaults(serialNo: number, date = format(new Date(), "yyyy-MM-dd")): FormulaInput {
  return {
    date,
    serialNo: String(serialNo),
    // "" until the operator picks one; the rest of the form opens then.
    formulaType: "" as FormulaInput["formulaType"],
    name: "",
    mixingHours: "",
    mixingMinutes: "",
    items: [emptyItem()],
    totalQuantityRequired: "",
  };
}

/** A typed number, or 0 while the field is empty or half-typed ("12."). */
function num(v: string | undefined): number {
  const n = Number(v);
  return v && Number.isFinite(n) && n > 0 ? n : 0;
}

export function FormulaForm({
  suggestions,
  nextSerialNo,
  editing,
}: {
  suggestions: Suggestion[];
  nextSerialNo: number;
  /** A saved formula opened with Edit: the form starts with its values and
   *  saving updates that record. */
  editing?: { id: string; serialNo: number; name: string; values: FormulaInput };
}) {
  const router = useRouter();
  const [saving, startSaving] = useTransition();

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    getValues,
    formState: { errors },
  } = useForm<FormulaInput>({
    resolver: zodResolver(formulaInputSchema),
    defaultValues: editing?.values ?? defaults(nextSerialNo),
    mode: "onTouched",
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const formulaType = useWatch({ control, name: "formulaType" });
  const formulaName = useWatch({ control, name: "name" });
  const items = useWatch({ control, name: "items" });
  const totalRequired = useWatch({ control, name: "totalQuantityRequired" });

  const calcItems: CalcItem[] = (items ?? []).map((i) => ({ unit: i.unit, quantity: num(i.quantity) }));
  const requirement = calculateRequirement(calcItems, num(totalRequired));
  const excludeKeys = useMemo(() => (formulaName ? [nameKey(formulaName)] : []), [formulaName]);

  const onSubmit = (values: FormulaInput) =>
    startSaving(async () => {
      const result = await saveFormula(values, editing?.id);
      if (!result.ok) {
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          setError(field as FieldPath<FormulaInput>, { type: "server", message });
        }
        toast.error(result.error);
        return;
      }
      if (editing) {
        toast.success(`Formula "${result.name}" updated (S.No. ${result.serialNo})`);
        router.replace("/formula-creation", { scroll: false });
        router.refresh();
        return;
      }
      toast.success(`Formula "${result.name}" saved (S.No. ${result.serialNo})`);
      reset(defaults(result.serialNo + 1, getValues("date")));
      router.refresh();
    });

  return (
    <form
      onSubmit={handleSubmit(onSubmit, () => toast.error("Please correct the highlighted fields."))}
      // Enter in a field must not save a half-entered formula; only the button does.
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault();
      }}
      className="space-y-6"
      noValidate
    >
      {editing && <EditBanner label={`formula ${editing.name} (S.No. ${editing.serialNo})`} cancelHref="/formula-creation" />}

      {/* 1. Basic fields */}
      <section className="card p-5">
        <h2 className="mb-4 text-base font-semibold text-pacific-dark">Basic Fields</h2>
        <div className="grid gap-4 sm:grid-cols-3">
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
          <div>
            <label htmlFor="formulaType" className="field-label">Formula Type</label>
            <select
              id="formulaType"
              className="field-input"
              aria-invalid={!!errors.formulaType || undefined}
              {...register("formulaType")}
            >
              <option value="" disabled>Select formula type…</option>
              {FORMULA_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {errors.formulaType && <p className="field-error">{errors.formulaType.message}</p>}
          </div>
        </div>
      </section>

      {!formulaType ? (
        <div className="card border-dashed px-6 py-10 text-center text-sm text-gray-500">
          Select a <span className="font-semibold text-gray-700">Formula Type</span> above to open the formula form.
        </div>
      ) : (
        <>
          {/* 2. Formula details */}
          <section className="card p-5">
            <h2 className="mb-4 text-base font-semibold text-pacific-dark">Formula Details</h2>
            <div className="max-w-md">
              <label htmlFor="name" className="field-label">Formula Name</label>
              <input
                id="name"
                type="text"
                autoComplete="off"
                placeholder="e.g. SW, #SW123, 5738"
                className="field-input"
                aria-invalid={!!errors.name || undefined}
                {...register("name")}
              />
              {errors.name && <p className="field-error">{errors.name.message}</p>}
            </div>

            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold text-gray-800">Materials / Colors Used</h3>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    <tr>
                      <th className="w-16 px-3 py-2">S.No.</th>
                      <th className="px-3 py-2">Material/Color Name</th>
                      <th className="w-32 px-3 py-2">Measurement Unit</th>
                      <th className="w-40 px-3 py-2">Quantity</th>
                      <th className="w-12 px-3 py-2"><span className="sr-only">Remove</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {fields.map((field, index) => {
                      const rowErrors = errors.items?.[index];
                      return (
                        <tr key={field.id} className="align-top">
                          <td className="px-3 pt-4 font-medium text-gray-700">{index + 1}</td>
                          <td className="px-3 py-2">
                            <Controller
                              control={control}
                              name={`items.${index}.name`}
                              render={({ field: f }) => (
                                <SuggestCombobox
                                  ref={f.ref}
                                  value={f.value}
                                  onChange={f.onChange}
                                  onBlur={f.onBlur}
                                  suggestions={suggestions}
                                  excludeKeys={excludeKeys}
                                  newLabel="New material"
                                  invalid={!!rowErrors?.name}
                                  placeholder="Material / color / formula"
                                  aria-label={`Material/Color name for row ${index + 1}`}
                                />
                              )}
                            />
                            {rowErrors?.name && <p className="field-error">{rowErrors.name.message}</p>}
                          </td>
                          <td className="px-3 py-2">
                            <select className="field-input" aria-label={`Unit for row ${index + 1}`} {...register(`items.${index}.unit`)}>
                              {UNIT_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              placeholder="0.000"
                              aria-label={`Quantity for row ${index + 1}`}
                              className="field-input text-right tabular-nums"
                              aria-invalid={!!rowErrors?.quantity || undefined}
                              {...register(`items.${index}.quantity`)}
                            />
                            {rowErrors?.quantity && <p className="field-error">{rowErrors.quantity.message}</p>}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {fields.length > 1 && (
                              <button
                                type="button"
                                onClick={() => remove(index)}
                                className="rounded-md p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                                aria-label={`Remove row ${index + 1}`}
                                title="Remove row"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {errors.items?.root && <p className="field-error">{errors.items.root.message}</p>}
              {errors.items?.message && <p className="field-error">{errors.items.message}</p>}
              <button type="button" onClick={() => append(emptyItem())} className="btn-secondary mt-3">
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
          </section>

          {/* 3. Mixing time */}
          <section className="card p-5">
            <h2 className="mb-4 text-base font-semibold text-pacific-dark">Mixing Time</h2>
            <div className="flex flex-wrap items-start gap-4">
              <div className="w-36">
                <label htmlFor="mixingHours" className="field-label">Hours</label>
                <input
                  id="mixingHours"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  className="field-input tabular-nums"
                  aria-invalid={!!errors.mixingHours || undefined}
                  {...register("mixingHours")}
                />
                {errors.mixingHours && <p className="field-error">{errors.mixingHours.message}</p>}
              </div>
              <div className="w-36">
                <label htmlFor="mixingMinutes" className="field-label">Minutes</label>
                <input
                  id="mixingMinutes"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  className="field-input tabular-nums"
                  aria-invalid={!!errors.mixingMinutes || undefined}
                  {...register("mixingMinutes")}
                />
                {errors.mixingMinutes && <p className="field-error">{errors.mixingMinutes.message}</p>}
              </div>
            </div>
          </section>

          {/* 4. Requirement table */}
          <RequirementTable
            requirement={requirement}
            items={(items ?? []).map((i) => ({ name: i.name, unit: i.unit, quantity: num(i.quantity) }))}
            totalRequiredInput={
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="e.g. 200"
                    aria-label="Total Quantity Required in kg"
                    className="field-input w-40 text-right tabular-nums"
                    aria-invalid={!!errors.totalQuantityRequired || undefined}
                    {...register("totalQuantityRequired")}
                  />
                  <span className="text-sm text-gray-600">kg</span>
                </div>
                {errors.totalQuantityRequired && (
                  <p className="field-error">{errors.totalQuantityRequired.message}</p>
                )}
              </>
            }
          />

          {/* 5. Save */}
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
              {saving ? "Saving…" : editing ? "Update Formula" : "Save Formula"}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
