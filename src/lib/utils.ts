import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Trimmed, lower-cased, inner whitespace collapsed — the key two names are
 *  compared on, so "SP  Yellow " and "sp yellow" are the same material. */
export function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}
