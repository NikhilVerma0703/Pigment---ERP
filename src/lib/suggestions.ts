// What a suggestion field (SuggestCombobox) offers. Shared by the server
// queries that build the lists and the client components that show them.

export type SuggestionKind = "formula" | "material" | "color" | "value";

export interface Suggestion {
  kind: SuggestionKind;
  id: string;
  name: string;
}

/** Plain previously-entered values (batch numbers, LOC numbers, …). */
export function valueSuggestions(values: string[]): Suggestion[] {
  return values.map((v) => ({ kind: "value" as const, id: v, name: v }));
}
