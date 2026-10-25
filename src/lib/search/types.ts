// Result and detail shapes for Searching. Plain data (numbers, strings) so
// they cross from server to client and into the Excel export unchanged.

import type { Unit } from "@/lib/formula/calc";

export interface FormulaDetail {
  id: string;
  serialNo: number;
  date: string;
  name: string;
  typeLabel: string;
  mixingHours: number;
  mixingMinutes: number;
  totalUsedKg: number;
  requiredKg: number;
  rate: number;
  items: {
    lineNo: number;
    name: string;
    unit: Unit;
    quantity: number;
    requiredQuantity: number;
    isFormula: boolean;
  }[];
}

export interface PigmentLine {
  lineNo: number;
  name: string;
  unit: Unit;
  /** Per cycle. */
  quantity: number;
  isFormula: boolean;
  cycles: number;
  consumedKg: number;
}

export interface ProductionDetail {
  id: string;
  serialNo: number;
  date: string;
  batchNumber: string;
  locNumber: string;
  designName: string;
  totalCycles: number;
  mixersUsed: number;
  pigmentKg: number;
  materialKg: number;
  mixers: {
    label: string;
    cycleTimeChanged: boolean;
    /** Cycles the base pigment rows ran for. */
    baseCycles: number;
    pigments: PigmentLine[];
    changes: { seq: number; fromCycle: number; toCycle: number; pigments: PigmentLine[] }[];
    materials: { lineNo: number; name: string; unit: Unit; quantity: number; kg: number; isStandard: boolean }[];
  }[];
}

export type DetailRef = { type: "formula" | "production"; id: string };

export interface PigmentTxn {
  id: string;
  date: string;
  pigment: string;
  color: string | null;
  kind: "in" | "formula" | "production";
  reference: string;
  batchNumber: string;
  locNumber: string;
  designName: string;
  mixer: string;
  range: string;
  cycles: number | null;
  quantity: number;
  unit: Unit;
  inKg: number;
  outKg: number;
  /** Stock left after this transaction; null for pigments not on the stock list. */
  balanceKg: number | null;
  ref: DetailRef | null;
}

export interface PigmentSummary {
  name: string;
  color: string | null;
  tracked: boolean;
  totalStockKg: number;
  consumedAllKg: number;
  remainingKg: number;
  /** Consumed within the current filters. */
  consumedFilteredKg: number;
}

export interface MaterialRow {
  id: string;
  date: string;
  batchNumber: string;
  locNumber: string;
  designName: string;
  mixer: string;
  material: string;
  unit: Unit;
  quantity: number;
  kg: number;
  recordId: string;
}

export interface MaterialDaily {
  date: string;
  material: string;
  kg: number;
  cumulativeKg: number;
}

export interface SearchSuggestions {
  formulaNames: string[];
  formulaMaterials: string[];
  pigments: string[];
  batches: string[];
  locs: string[];
  designs: string[];
  materials: string[];
}
