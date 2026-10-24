import type { MixerType } from "@prisma/client";

/** Mixers in the order the form shows them; "Number of Mixers Used" = N
 *  shows the first N. */
export const MIXERS: { value: MixerType; label: string }[] = [
  { value: "MIXER_1", label: "Mixer-1" },
  { value: "MIXER_2", label: "Mixer-2" },
  { value: "ROYMIX", label: "Roymix Mixer" },
];

export const MAX_MIXERS = MIXERS.length;

/** The standard rows of every mixer's Materials Consumption table. */
export const STANDARD_MATERIALS = ["Grit", "Powder", "Resin", "Catalyst", "Cobalt", "Silane"] as const;

/** Upper bound on "How Many Times It Changed" — a guard against a typo
 *  generating hundreds of entries, not a business rule. */
export const MAX_CYCLE_CHANGES = 50;

export function mixerLabel(mixer: MixerType): string {
  return MIXERS.find((m) => m.value === mixer)?.label ?? mixer;
}
