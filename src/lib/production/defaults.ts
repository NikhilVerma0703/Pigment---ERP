// Blank Daily Production form values. Shared by the form (new records) and
// the edit loader on the server (slots a saved record does not use).

import { MATERIAL_SPECS, type MaterialCategory } from "@/lib/production/materials";
import type { MaterialRowInput, MixerInput, PigmentRowInput } from "@/lib/production/schema";

export const emptyPigment = (): PigmentRowInput => ({ name: "", unit: "KG", quantity: "" });

export const emptyMaterial = (category: MaterialCategory): MaterialRowInput => ({
  category,
  name: "",
  size: "",
  itemName: "",
  color: "",
  percent: "",
  unit: "KG",
  quantity: "",
});

/** A mixer starts with one blank entry for each of the six standard materials. */
export const defaultMaterials = (): MaterialRowInput[] => MATERIAL_SPECS.map((s) => emptyMaterial(s.category));

export const emptyMixer = (): MixerInput => ({
  pigments: [emptyPigment()],
  cycleTimeChanged: "NO",
  changeCount: "",
  changes: [],
  materials: defaultMaterials(),
});
