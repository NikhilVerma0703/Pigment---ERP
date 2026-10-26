"use client";

import { get, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Copy } from "lucide-react";
import { MaterialsConsumption, type MaterialSuggestions } from "@/components/production/MaterialsConsumption";
import { emptyPigment, PigmentTable } from "@/components/production/PigmentTable";
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
  materialSuggestions: MaterialSuggestions;
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
          <MaterialsConsumption index={index} label={label} suggestions={materialSuggestions} />
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

