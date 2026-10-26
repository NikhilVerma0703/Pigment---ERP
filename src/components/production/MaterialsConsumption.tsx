"use client";

import { useState } from "react";
import { Controller, get, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { SuggestCombobox } from "@/components/ui/SuggestCombobox";
import { formatQty } from "@/lib/formula/calc";
import { UNIT_OPTIONS } from "@/lib/formula/constants";
import {
  entryKg,
  MATERIAL_SPECS,
  OTHER_SPEC,
  percentQuantity,
  resinKg,
  type MaterialCategory,
  type MaterialSpec,
} from "@/lib/production/materials";
import { emptyMaterial } from "@/lib/production/defaults";
import type { MaterialRowInput, ProductionInput } from "@/lib/production/schema";
import type { Suggestion } from "@/lib/suggestions";

export interface MaterialSuggestions {
  /** "+ Others" material names. */
  others: Suggestion[];
  /** Entry names per category (Grit Name, Resin Name, …). */
  names: Record<string, Suggestion[]>;
  /** Grit / Powder colours. */
  colors: Suggestion[];
}

export { defaultMaterials, emptyMaterial } from "@/lib/production/defaults";

type Path = `mixers.0.materials.0.${keyof MaterialRowInput}`;
const OTHER_SIZE = "__other";

/**
 * B. Materials Consumption — one block per material, each with any number of
 * entries (e.g. two grit sizes with their own quantities) and a running total.
 * Catalyst, Cobalt and Silane take a percentage; their quantity is calculated
 * from the mixer's total resin and updates as either changes.
 */
export function MaterialsConsumption({
  index,
  label,
  suggestions,
}: {
  index: number;
  label: string;
  suggestions: MaterialSuggestions;
}) {
  const { control } = useFormContext<ProductionInput>();
  const base = `mixers.${index}.materials` as const;
  const { fields, append, remove } = useFieldArray({ control, name: base });
  const entries = (useWatch({ control, name: base }) ?? []) as MaterialRowInput[];
  const resin = resinKg(entries);

  return (
    <div className="space-y-4">
      {[...MATERIAL_SPECS, OTHER_SPEC].map((spec, si) => {
        const rows = fields.map((f, i) => ({ id: f.id, i })).filter(({ i }) => entries[i]?.category === spec.category);
        const totalKg = rows.reduce((s, { i }) => s + (entries[i] ? entryKg(entries[i], resin) : 0), 0);
        return (
          <MaterialBlock
            key={spec.category}
            no={si + 1}
            spec={spec}
            base={base}
            rows={rows}
            entries={entries}
            resin={resin}
            totalKg={totalKg}
            mixerLabel={label}
            suggestions={suggestions}
            onAdd={() => append(emptyMaterial(spec.category), { shouldFocus: false })}
            onRemove={remove}
          />
        );
      })}
    </div>
  );
}

function MaterialBlock({
  no,
  spec,
  base,
  rows,
  entries,
  resin,
  totalKg,
  mixerLabel,
  suggestions,
  onAdd,
  onRemove,
}: {
  no: number;
  spec: MaterialSpec;
  base: `mixers.${number}.materials`;
  rows: { id: string; i: number }[];
  entries: MaterialRowInput[];
  resin: number;
  totalKg: number;
  mixerLabel: string;
  suggestions: MaterialSuggestions;
  onAdd: () => void;
  onRemove: (i: number) => void;
}) {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<ProductionInput>();
  const isOther = spec.category === "OTHER";
  const title = isOther ? "Others" : spec.label;
  const nameLabel = isOther ? "Material Name" : `${spec.label} Name`;
  const th = "whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600";
  const path = (i: number, field: keyof MaterialRowInput) => `${base}.${i}.${field}` as Path;
  const err = (i: number, field: keyof MaterialRowInput) => get(errors, `${base}.${i}.${field}`)?.message as string | undefined;
  const aria = (i: number, what: string) => `${mixerLabel} ${title} ${what} for entry ${rows.findIndex((r) => r.i === i) + 1}`;

  const combo = (i: number, field: "name" | "itemName" | "color", list: Suggestion[], placeholder: string) => (
    <>
      <Controller
        control={control}
        name={path(i, field)}
        render={({ field: f }) => (
          <SuggestCombobox
            ref={f.ref}
            value={String(f.value ?? "")}
            onChange={f.onChange}
            onBlur={f.onBlur}
            suggestions={list}
            invalid={!!err(i, field)}
            newLabel="New"
            placeholder={placeholder}
            aria-label={aria(i, field === "color" ? "color" : "name")}
          />
        )}
      />
      {err(i, field) && <p className="field-error">{err(i, field)}</p>}
    </>
  );

  return (
    <div className="rounded-lg border border-gray-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2">
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-semibold text-gray-900">{no}. {title}</span>
          {spec.percent && <span className="text-xs text-gray-500">% of resin ({formatQty(resin)} kg)</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-600">
            Total: <span className="font-semibold tabular-nums text-gray-900">{formatQty(totalKg)} kg</span>
          </span>
          <button type="button" onClick={onAdd} className="btn-secondary px-2.5 py-1 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add {isOther ? "Other Material" : spec.label}
          </button>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-3 text-xs text-gray-400">No entries.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr>
                <th className={`${th} w-12`}>#</th>
                {spec.sizes && <th className={`${th} w-44`}>{spec.label} Size</th>}
                <th className={th}>{nameLabel}</th>
                {spec.color && <th className={th}>{spec.label} Color</th>}
                {spec.percent && <th className={`${th} w-28`}>Percentage</th>}
                <th className={`${th} w-28`}>Unit</th>
                <th className={`${th} w-36`}>Quantity Used</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(({ id, i }, n) => {
                const e = entries[i];
                const calculated = spec.percent && e ? percentQuantity(e.percent, e.unit, resin) : null;
                return (
                  <tr key={id} className="align-top">
                    <td className="px-3 pt-4 text-gray-600">{n + 1}</td>
                    {spec.sizes && (
                      <td className="px-3 py-2">
                        <SizeField
                          presets={spec.sizes}
                          value={e?.size ?? ""}
                          control={control}
                          name={path(i, "size")}
                          ariaLabel={aria(i, "size")}
                        />
                      </td>
                    )}
                    <td className="px-3 py-2">
                      {isOther
                        ? combo(i, "name", suggestions.others, "Material name")
                        : combo(i, "itemName", suggestions.names[spec.category] ?? [], `${spec.label} name`)}
                    </td>
                    {spec.color && <td className="px-3 py-2">{combo(i, "color", suggestions.colors, "Color")}</td>}
                    {spec.percent && (
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="0"
                            aria-label={aria(i, "percentage")}
                            className="field-input text-right tabular-nums"
                            aria-invalid={!!err(i, "percent") || undefined}
                            {...register(path(i, "percent"))}
                          />
                          <span className="text-sm text-gray-500">%</span>
                        </div>
                        {err(i, "percent") && <p className="field-error">{err(i, "percent")}</p>}
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <select className="field-input" aria-label={aria(i, "unit")} {...register(path(i, "unit"))}>
                        {UNIT_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      {spec.percent ? (
                        <div
                          className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-right tabular-nums text-gray-900"
                          aria-label={aria(i, "calculated quantity")}
                          title={`${e?.percent || 0}% × ${formatQty(resin)} kg resin`}
                        >
                          {calculated === null ? <span className="text-gray-400">auto</span> : formatQty(calculated)}
                        </div>
                      ) : (
                        <>
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="0.000"
                            aria-label={aria(i, "quantity")}
                            className="field-input text-right tabular-nums"
                            aria-invalid={!!err(i, "quantity") || undefined}
                            {...register(path(i, "quantity"))}
                          />
                          {err(i, "quantity") && <p className="field-error">{err(i, "quantity")}</p>}
                        </>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => onRemove(i)}
                        className="rounded-md p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                        aria-label={`Remove ${aria(i, "entry")}`}
                        title="Remove entry"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Size dropdown with the preset sizes and "+ Others", which opens a text box
 *  for any other size. A saved size that is not a preset reopens as Others. */
function SizeField({
  presets,
  value,
  control,
  name,
  ariaLabel,
}: {
  presets: readonly string[];
  value: string;
  control: ReturnType<typeof useFormContext<ProductionInput>>["control"];
  name: Path;
  ariaLabel: string;
}) {
  const [other, setOther] = useState(value !== "" && !presets.includes(value));
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="space-y-1.5">
          <select
            className="field-input"
            aria-label={ariaLabel}
            value={other ? OTHER_SIZE : String(field.value ?? "")}
            onChange={(e) => {
              if (e.target.value === OTHER_SIZE) {
                setOther(true);
                field.onChange("");
              } else {
                setOther(false);
                field.onChange(e.target.value);
              }
            }}
          >
            <option value="">Select size…</option>
            {presets.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
            <option value={OTHER_SIZE}>+ Others</option>
          </select>
          {other && (
            <input
              type="text"
              autoComplete="off"
              placeholder="Enter size"
              aria-label={`${ariaLabel} (other)`}
              className="field-input"
              value={String(field.value ?? "")}
              onChange={(e) => field.onChange(e.target.value)}
              onBlur={field.onBlur}
            />
          )}
        </div>
      )}
    />
  );
}
