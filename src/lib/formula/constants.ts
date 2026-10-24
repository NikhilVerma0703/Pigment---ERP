import type { FormulaType, MeasurementUnit } from "@prisma/client";

export const FORMULA_TYPE_OPTIONS: { value: FormulaType; label: string }[] = [
  { value: "LIQUID_VEIN", label: "Liquid Vein" },
  { value: "DRY_VEIN_PIGMENT", label: "Dry Vein + Pigment" },
  { value: "OTHERS", label: "+ Others" },
];

export const UNIT_OPTIONS: { value: MeasurementUnit; label: string }[] = [
  { value: "KG", label: "Kg" },
  { value: "GM", label: "Gm" },
];

export function formulaTypeLabel(type: FormulaType): string {
  return FORMULA_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}
