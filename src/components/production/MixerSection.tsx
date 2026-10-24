"use client";

import { Controller, get, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Copy, Plus, Trash2 } from "lucide-react";
import { emptyPigment, PigmentTable } from "@/components/production/PigmentTable";
import { SuggestCombobox } from "@/components/ui/SuggestCombobox";
import { UNIT_OPTIONS } from "@/lib/formula/constants";
import { MAX_CYCLE_CHANGES } from "@/lib/production/constants";
import type { CycleChangeInput, PigmentRowInput, ProductionInput } from "@/lib/production/schema";
import type { Suggestion } from "@/lib/suggestions";

const ORDINALS = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"];
const ordinal = (i: number) => (i < ORDINALS.length ? `${ORDINALS[i]} Time` : `Change ${i + 1}`);

export function MixerSection({
  index,
  label,
  pigmentSuggestions,
  materialSuggestions,
}: {
  index: number;
  label: string;
  pigmentSuggestions: Suggestion[];
  materialSuggestions: Suggestion[];
}) {
  return (
    <section className="card overflow-hidden">
      <header className="border-b border-gray-200 bg-brand-50/60 px-5 py-3">
        <h2 className="text-base font-bold text-brand-800">{label}</h2>
      </header>
      <div className="space-y-8 p-5">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-800">A. Pigment/Color Details</h3>
          <PigmentTable name={`mixers.${index}.pigments`} suggestions={pigmentSuggestions} label={label} />
          <CycleChanges index={index} label={label} pigmentSuggestions={pigmentSuggestions} />
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-800">B. Materials Consumption</h3>
          <MaterialsTable index={index} label={label} suggestions={materialSuggestions} />
        </div>
      </div>
    </section>
  );
}

/** "Cycle Time Changed" Yes/No, "How Many Times It Changed" and the generated
 *  change entries. Each new entry is prefilled with a copy of the mixer's
 *  pigment rows at the moment it is generated; after that it is independent. */
function CycleChanges({
  index,
  label,
  pigmentSuggestions,
}: {
  index: number;
  label: string;
  pigmentSuggestions: Suggestion[];
}) {
  const {
    control,
    register,
    getValues,
    setValue,
    formState: { errors },
  } = useFormContext<ProductionInput>();
  const base = `mixers.${index}` as const;
  const { fields, append, remove, replace } = useFieldArray({ control, name: `${base}.changes` });
  const changed = useWatch({ control, name: `${base}.cycleTimeChanged` });
  const totalCycles = useWatch({ control, name: "totalCycles" });

  const copyOfPigments = (): PigmentRowInput[] => {
    const rows = getValues(`${base}.pigments`).filter((r) => r.name.trim() || r.quantity.trim());
    return rows.length ? rows.map((r) => ({ ...r })) : [emptyPigment()];
  };

  const syncCount = (raw: string) => {
    const n = Number(raw);
    if (!/^\d+$/.test(raw.trim()) || n < 1 || n > MAX_CYCLE_CHANGES) return;
    const current = getValues(`${base}.changes`);
    if (n < current.length) {
      remove(Array.from({ length: current.length - n }, (_, k) => n + k));
      return;
    }
    const total = /^\d+$/.test(totalCycles?.trim() ?? "") ? totalCycles.trim() : "";
    const entries: CycleChangeInput[] = [];
    for (let k = current.length; k < n; k++) {
      const prevTo = k === 0 ? "0" : (entries[k - current.length - 1]?.toCycle ?? current[k - 1]?.toCycle ?? "");
      entries.push({
        fromCycle: k === 0 ? "1" : /^\d+$/.test(prevTo) ? String(Number(prevTo) + 1) : "",
        toCycle: k === n - 1 ? total : "",
        pigments: copyOfPigments(),
      });
    }
    append(entries);
  };

  // Typing a range's "To" starts the next range on the following cycle.
  const onToChange = (ci: number, value: string) => {
    if (ci + 1 >= getValues(`${base}.changes`).length) return;
    if (/^\d+$/.test(value.trim())) {
      setValue(`${base}.changes.${ci + 1}.fromCycle`, String(Number(value) + 1), { shouldValidate: false });
    }
  };

  const countError = get(errors, `${base}.changeCount`)?.message as string | undefined;

  return (
    <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50/60 p-4">
      <div className="flex flex-wrap items-start gap-4">
        <div className="w-44">
          <label className="field-label" htmlFor={`${base}-cycleTimeChanged`}>Cycle Time Changed</label>
          <select
            id={`${base}-cycleTimeChanged`}
            className="field-input"
            {...register(`${base}.cycleTimeChanged`, {
              onChange: (e) => {
                if (e.target.value === "NO") {
                  replace([]);
                  setValue(`${base}.changeCount`, "");
                }
              },
            })}
          >
            <option value="NO">No</option>
            <option value="YES">Yes</option>
          </select>
        </div>
        {changed === "YES" && (
          <div className="w-56">
            <label className="field-label" htmlFor={`${base}-changeCount`}>How Many Times It Changed</label>
            <input
              id={`${base}-changeCount`}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 3"
              className="field-input tabular-nums"
              aria-invalid={!!countError || undefined}
              {...register(`${base}.changeCount`, { onChange: (e) => syncCount(e.target.value) })}
            />
            {countError && <p className="field-error">{countError}</p>}
          </div>
        )}
      </div>

      {changed === "YES" && fields.length > 0 && (
        <div className="mt-4 space-y-4">
          {fields.map((field, ci) => {
            const errs = get(errors, `${base}.changes.${ci}`);
            return (
              <div key={field.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="mb-3 flex flex-wrap items-end gap-4">
                  <div className="mr-2 self-center text-sm font-semibold text-brand-700">{ordinal(ci)}</div>
                  <div className="w-32">
                    <label className="field-label" htmlFor={`${base}-c${ci}-from`}>From Cycle</label>
                    <input
                      id={`${base}-c${ci}-from`}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      className="field-input tabular-nums"
                      aria-invalid={!!errs?.fromCycle || undefined}
                      {...register(`${base}.changes.${ci}.fromCycle`)}
                    />
                  </div>
                  <div className="w-32">
                    <label className="field-label" htmlFor={`${base}-c${ci}-to`}>To Cycle</label>
                    <input
                      id={`${base}-c${ci}-to`}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      className="field-input tabular-nums"
                      aria-invalid={!!errs?.toCycle || undefined}
                      {...register(`${base}.changes.${ci}.toCycle`, { onChange: (e) => onToChange(ci, e.target.value) })}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-secondary ml-auto"
                    title="Replace this entry's pigments with the Pigment/Color Details above"
                    onClick={() => setValue(`${base}.changes.${ci}.pigments`, copyOfPigments(), { shouldDirty: true })}
                  >
                    <Copy className="h-4 w-4" /> Copy from pigment details
                  </button>
                </div>
                {(errs?.fromCycle || errs?.toCycle) && (
                  <p className="field-error -mt-1 mb-3">{errs?.fromCycle?.message ?? errs?.toCycle?.message}</p>
                )}
                <PigmentTable
                  name={`${base}.changes.${ci}.pigments`}
                  suggestions={pigmentSuggestions}
                  label={`${label} ${ordinal(ci)}`}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Six standard materials (name fixed) plus any "+ Add/Others" rows. */
function MaterialsTable({ index, label, suggestions }: { index: number; label: string; suggestions: Suggestion[] }) {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<ProductionInput>();
  const base = `mixers.${index}.materials` as const;
  const { fields, append, remove } = useFieldArray({ control, name: base });

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
            <tr>
              <th className="w-16 px-3 py-2">S.No.</th>
              <th className="px-3 py-2">Material</th>
              <th className="w-32 px-3 py-2">Measurement Unit</th>
              <th className="w-40 px-3 py-2">Quantity Used</th>
              <th className="w-12 px-3 py-2"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {fields.map((field, mi) => {
              const rowErrors = get(errors, `${base}.${mi}`);
              return (
                <tr key={field.id} className="align-top">
                  <td className="px-3 pt-4 font-medium text-gray-700">{mi + 1}</td>
                  <td className="px-3 py-2">
                    {field.isStandard ? (
                      <div className="py-2 font-medium text-gray-800">{field.name}</div>
                    ) : (
                      <>
                        <Controller
                          control={control}
                          name={`${base}.${mi}.name`}
                          render={({ field: f }) => (
                            <SuggestCombobox
                              ref={f.ref}
                              value={f.value}
                              onChange={f.onChange}
                              onBlur={f.onBlur}
                              suggestions={suggestions}
                              invalid={!!rowErrors?.name}
                              newLabel="New material"
                              placeholder="Other material"
                              aria-label={`${label} material name for row ${mi + 1}`}
                            />
                          )}
                        />
                        {rowErrors?.name && <p className="field-error">{rowErrors.name.message}</p>}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="field-input"
                      aria-label={`${label} ${field.name || "material"} unit`}
                      {...register(`${base}.${mi}.unit`)}
                    >
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
                      aria-label={`${label} ${field.name || "material"} quantity`}
                      className="field-input text-right tabular-nums"
                      aria-invalid={!!rowErrors?.quantity || undefined}
                      {...register(`${base}.${mi}.quantity`)}
                    />
                    {rowErrors?.quantity && <p className="field-error">{rowErrors.quantity.message}</p>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!field.isStandard && (
                      <button
                        type="button"
                        onClick={() => remove(mi)}
                        className="rounded-md p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                        aria-label={`${label} remove material row ${mi + 1}`}
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
      <button
        type="button"
        onClick={() => append({ name: "", isStandard: false, unit: "KG", quantity: "" })}
        className="btn-secondary mt-3"
      >
        <Plus className="h-4 w-4" /> Add/Others
      </button>
    </div>
  );
}
