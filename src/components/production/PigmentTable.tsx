"use client";

import { Controller, get, useFieldArray, useFormContext } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { SuggestCombobox } from "@/components/ui/SuggestCombobox";
import { UNIT_OPTIONS } from "@/lib/formula/constants";
import type { PigmentRowInput, ProductionInput } from "@/lib/production/schema";
import type { Suggestion } from "@/lib/suggestions";

export type PigmentArrayName = `mixers.${number}.pigments` | `mixers.${number}.changes.${number}.pigments`;

export const emptyPigment = (): PigmentRowInput => ({ name: "", unit: "KG", quantity: "" });

/** S.No. / Pigment-Color Used / Measurement Unit / Quantity Used, with + Add.
 *  Used for a mixer's Pigment/Color Details and for each cycle-change entry. */
export function PigmentTable({
  name,
  suggestions,
  label,
}: {
  name: PigmentArrayName;
  suggestions: Suggestion[];
  /** Prefix for the inputs' accessible names, e.g. "Mixer-1". */
  label: string;
}) {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<ProductionInput>();
  const { fields, append, remove } = useFieldArray({ control, name: name as `mixers.0.pigments` });
  // The resolver files an error on a field-array path under `.root`.
  const arrayErrors = get(errors, name);
  const tableError = (arrayErrors?.root?.message ?? arrayErrors?.message) as string | undefined;

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
            <tr>
              <th className="w-16 px-3 py-2">S.No.</th>
              <th className="px-3 py-2">Pigment/Color Used</th>
              <th className="w-32 px-3 py-2">Measurement Unit</th>
              <th className="w-40 px-3 py-2">Quantity Used</th>
              <th className="w-12 px-3 py-2"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {fields.map((field, index) => {
              const rowErrors = get(errors, `${name}.${index}`);
              return (
                <tr key={field.id} className="align-top">
                  <td className="px-3 pt-4 font-medium text-gray-700">{index + 1}</td>
                  <td className="px-3 py-2">
                    <Controller
                      control={control}
                      name={`${name}.${index}.name` as `mixers.0.pigments.0.name`}
                      render={({ field: f }) => (
                        <SuggestCombobox
                          ref={f.ref}
                          value={f.value}
                          onChange={f.onChange}
                          onBlur={f.onBlur}
                          suggestions={suggestions}
                          invalid={!!rowErrors?.name}
                          newLabel="New color"
                          placeholder="Select formula or type a color"
                          aria-label={`${label} pigment/color for row ${index + 1}`}
                        />
                      )}
                    />
                    {rowErrors?.name && <p className="field-error">{rowErrors.name.message}</p>}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="field-input"
                      aria-label={`${label} unit for row ${index + 1}`}
                      {...register(`${name}.${index}.unit` as `mixers.0.pigments.0.unit`)}
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
                      aria-label={`${label} quantity for row ${index + 1}`}
                      className="field-input text-right tabular-nums"
                      aria-invalid={!!rowErrors?.quantity || undefined}
                      {...register(`${name}.${index}.quantity` as `mixers.0.pigments.0.quantity`)}
                    />
                    {rowErrors?.quantity && <p className="field-error">{rowErrors.quantity.message}</p>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="rounded-md p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                        aria-label={`${label} remove row ${index + 1}`}
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
      {tableError && <p className="field-error">{tableError}</p>}
      <button type="button" onClick={() => append(emptyPigment())} className="btn-secondary mt-3">
        <Plus className="h-4 w-4" /> Add
      </button>
    </div>
  );
}
