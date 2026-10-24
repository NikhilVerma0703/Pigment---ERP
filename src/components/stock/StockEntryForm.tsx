"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, get, useFieldArray, useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveStock } from "@/app/stocks-consumption/actions";
import { SuggestCombobox } from "@/components/ui/SuggestCombobox";
import { UNIT_OPTIONS } from "@/lib/formula/constants";
import { stockInputSchema, type StockInput, type StockRowInput } from "@/lib/stock/schema";
import type { Suggestion } from "@/lib/suggestions";

const emptyRow = (): StockRowInput => ({ name: "", unit: "KG", quantity: "" });

function defaults(): StockInput {
  return { rows: [emptyRow()] };
}

/** "+ Add" stock: one row per pigment, any number of rows. A name already on
 *  the stock list adds to its stock; a new name creates the pigment. */
export function StockEntryForm({ suggestions }: { suggestions: Suggestion[] }) {
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<StockInput>({ resolver: zodResolver(stockInputSchema), defaultValues: defaults(), mode: "onTouched" });
  const { fields, append, remove } = useFieldArray({ control, name: "rows" });

  const onSubmit = (values: StockInput) =>
    startSaving(async () => {
      const result = await saveStock(values);
      if (!result.ok) {
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          setError(field as FieldPath<StockInput>, { type: "server", message });
        }
        toast.error(result.error);
        return;
      }
      toast.success(`Stock added for ${result.count} pigment${result.count === 1 ? "" : "s"}`);
      reset(defaults());
      router.refresh();
    });

  const rowsError = (get(errors, "rows")?.root?.message ?? get(errors, "rows")?.message) as string | undefined;

  return (
    <form
      onSubmit={handleSubmit(onSubmit, () => toast.error("Please correct the highlighted fields."))}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault();
      }}
      noValidate
    >
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
            <tr>
              <th className="w-16 px-3 py-2">S.No.</th>
              <th className="px-3 py-2">Pigment/Color Name</th>
              <th className="w-32 px-3 py-2">Unit</th>
              <th className="w-40 px-3 py-2">Quantity</th>
              <th className="w-12 px-3 py-2"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {fields.map((field, i) => {
              const rowErrors = errors.rows?.[i];
              return (
                <tr key={field.id} className="align-top">
                  <td className="px-3 pt-4 font-medium text-gray-700">{i + 1}</td>
                  <td className="px-3 py-2">
                    <Controller
                      control={control}
                      name={`rows.${i}.name`}
                      render={({ field: f }) => (
                        <SuggestCombobox
                          ref={f.ref}
                          value={f.value}
                          onChange={f.onChange}
                          onBlur={f.onBlur}
                          suggestions={suggestions}
                          invalid={!!rowErrors?.name}
                          newLabel="New pigment"
                          placeholder="e.g. SW, Black, Green"
                          aria-label={`Pigment/Color name for row ${i + 1}`}
                        />
                      )}
                    />
                    {rowErrors?.name && <p className="field-error">{rowErrors.name.message}</p>}
                  </td>
                  <td className="px-3 py-2">
                    <select className="field-input" aria-label={`Unit for row ${i + 1}`} {...register(`rows.${i}.unit`)}>
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
                      aria-label={`Quantity for row ${i + 1}`}
                      className="field-input text-right tabular-nums"
                      aria-invalid={!!rowErrors?.quantity || undefined}
                      {...register(`rows.${i}.quantity`)}
                    />
                    {rowErrors?.quantity && <p className="field-error">{rowErrors.quantity.message}</p>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        className="rounded-md p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                        aria-label={`Remove row ${i + 1}`}
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
      {rowsError && <p className="field-error">{rowsError}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => append(emptyRow())} className="btn-secondary">
          <Plus className="h-4 w-4" /> Add
        </button>
        <button
          type="button"
          onClick={() => append(Array.from({ length: 10 }, emptyRow), { shouldFocus: false })}
          className="btn-secondary"
        >
          <Plus className="h-4 w-4" /> Add 10 rows
        </button>
        <button type="submit" className="btn-primary ml-auto" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : "Save Stock"}
        </button>
      </div>
    </form>
  );
}
