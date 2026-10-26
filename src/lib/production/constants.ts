import type { MixerKind } from "@prisma/client";

/**
 * Mixers: "Number of Mixers Used" = N gives Mixer 1 … Mixer N; "Roymix Used"
 * = Yes adds one Roymix Mixer after them.
 *
 * The form keeps MAX_REGULAR_MIXERS regular slots plus one Roymix slot, so
 * changing N back and forth never loses what was typed. ROYMIX_INDEX is the
 * Roymix slot's index in that array.
 */
export const MAX_REGULAR_MIXERS = 10;
export const ROYMIX_INDEX = MAX_REGULAR_MIXERS;
export const MIXER_SLOTS = MAX_REGULAR_MIXERS + 1;
export const ROYMIX_LABEL = "Roymix Mixer";

/** The standard rows of every mixer's Materials Consumption table. */
export const STANDARD_MATERIALS = ["Grit", "Powder", "Resin", "Catalyst", "Cobalt", "Silane"] as const;

/** Upper bound on "How Many Times It Changed" — a guard against a typo
 *  generating hundreds of entries, not a business rule. */
export const MAX_CYCLE_CHANGES = 50;

export function mixerLabel(kind: MixerKind, position: number): string {
  return kind === "ROYMIX" ? ROYMIX_LABEL : `Mixer ${position}`;
}

/** Form slot index → stored mixer identity. */
export function slotMixer(index: number): { kind: MixerKind; position: number } {
  return index === ROYMIX_INDEX ? { kind: "ROYMIX", position: 1 } : { kind: "REGULAR", position: index + 1 };
}

/** Sort key: regular mixers by number, then the Roymix Mixer. */
export function mixerOrder(kind: MixerKind, position: number): number {
  return kind === "ROYMIX" ? 1000 : position;
}

/** Options for a "Mixer" filter: Mixer 1 … Mixer 10, Roymix Mixer. Values
 *  are "1" … "10" and "roymix". */
export const MIXER_FILTER_OPTIONS = [
  ...Array.from({ length: MAX_REGULAR_MIXERS }, (_, i) => ({ value: String(i + 1), label: `Mixer ${i + 1}` })),
  { value: "roymix", label: ROYMIX_LABEL },
];

export function parseMixerFilter(value: string | undefined): { kind: MixerKind; position: number } | null {
  if (value === "roymix") return { kind: "ROYMIX", position: 1 };
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= MAX_REGULAR_MIXERS ? { kind: "REGULAR", position: n } : null;
}
