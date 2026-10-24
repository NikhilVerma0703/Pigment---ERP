"use client";

import { forwardRef, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Droplet, FlaskConical, History, Palette, Plus, type LucideIcon } from "lucide-react";
import type { Suggestion, SuggestionKind } from "@/lib/suggestions";
import { cn, nameKey } from "@/lib/utils";

const MAX_SHOWN = 50;

const KINDS: Record<SuggestionKind, { label: string; icon: LucideIcon; icon_cls: string; badge_cls: string; order: number }> = {
  formula: { label: "Formula", icon: FlaskConical, icon_cls: "text-brand-500", badge_cls: "bg-brand-100 text-brand-700", order: 0 },
  color: { label: "Color", icon: Palette, icon_cls: "text-amber-500", badge_cls: "bg-amber-50 text-amber-700", order: 1 },
  material: { label: "Material", icon: Droplet, icon_cls: "text-gray-400", badge_cls: "bg-gray-100 text-gray-600", order: 2 },
  value: { label: "", icon: History, icon_cls: "text-gray-400", badge_cls: "", order: 3 },
};

interface Props {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  suggestions: Suggestion[];
  invalid?: boolean;
  placeholder?: string;
  id?: string;
  "aria-label"?: string;
  /** Names that must not be offered (e.g. the formula being created). */
  excludeKeys?: string[];
  /** Shown under the list when the typed text matches nothing, e.g. "New material". */
  newLabel?: string;
}

/**
 * Free-text input with suggestions. Picking a suggestion fills the field;
 * typing a name that is not in the list is allowed and saved as a new value.
 * Saved formulas sort first, then colours, then materials, then plain values.
 *
 * The list is position: fixed under the input rather than absolute, so a
 * table's horizontal scroll container cannot clip it.
 */
export const SuggestCombobox = forwardRef<HTMLInputElement, Props>(function SuggestCombobox(
  {
    value,
    onChange,
    onBlur,
    suggestions,
    invalid,
    placeholder,
    id,
    excludeKeys = [],
    newLabel = "New value",
    "aria-label": ariaLabel,
  },
  forwardedRef,
) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null);

  const setRefs = (el: HTMLInputElement | null) => {
    inputRef.current = el;
    if (typeof forwardedRef === "function") forwardedRef(el);
    else if (forwardedRef) forwardedRef.current = el;
  };

  const key = nameKey(value ?? "");
  const matches = useMemo(() => {
    const excluded = new Set(excludeKeys);
    return suggestions
      .filter((s) => !excluded.has(nameKey(s.name)))
      .filter((s) => key === "" || nameKey(s.name).includes(key))
      .sort((a, b) => {
        // Prefix matches above substring matches, then by kind, then A–Z.
        const ap = nameKey(a.name).startsWith(key) ? 0 : 1;
        const bp = nameKey(b.name).startsWith(key) ? 0 : 1;
        if (ap !== bp) return ap - bp;
        if (a.kind !== b.kind) return KINDS[a.kind].order - KINDS[b.kind].order;
        return a.name.localeCompare(b.name);
      })
      .slice(0, MAX_SHOWN);
  }, [suggestions, key, excludeKeys]);

  const exact = suggestions.find((s) => nameKey(s.name) === key);

  const place = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ left: r.left, top: r.bottom + 4, width: Math.max(r.width, 260) });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  useEffect(() => setActive(0), [key]);

  const choose = (s: Suggestion) => {
    onChange(s.name);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, Math.max(matches.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      // Enter picks the highlighted suggestion instead of submitting the form.
      if (open && matches[active]) {
        e.preventDefault();
        choose(matches[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showList = open && (matches.length > 0 || key !== "");
  const ExactIcon = exact && exact.kind !== "value" ? KINDS[exact.kind].icon : null;

  return (
    <div className="relative">
      <input
        ref={setRefs}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        className="field-input pr-8"
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          onBlur?.();
        }}
        onKeyDown={onKeyDown}
      />
      {exact && ExactIcon && (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" title={KINDS[exact.kind].label}>
          <ExactIcon className={cn("h-4 w-4", KINDS[exact.kind].icon_cls)} aria-hidden />
        </span>
      )}
      {showList && rect && (
        <ul
          id={listId}
          role="listbox"
          style={{ left: rect.left, top: rect.top, width: rect.width }}
          className="fixed z-50 max-h-72 overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg"
          // Keep focus in the input while clicking an option.
          onMouseDown={(e) => e.preventDefault()}
        >
          {matches.map((s, i) => {
            const kind = KINDS[s.kind];
            const Icon = kind.icon;
            return (
              <li
                key={`${s.kind}-${s.id}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(s)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 px-3 py-2",
                  i === active ? "bg-brand-50 text-brand-800" : "text-gray-800",
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Icon className={cn("h-4 w-4 shrink-0", kind.icon_cls)} aria-hidden />
                  <span className="truncate">{s.name}</span>
                </span>
                {kind.label && (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      kind.badge_cls,
                    )}
                  >
                    {kind.label}
                  </span>
                )}
              </li>
            );
          })}
          {key !== "" && !exact && (
            <li className="flex items-center gap-2 border-t border-gray-100 px-3 py-2 text-gray-600">
              <Plus className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              <span>
                {newLabel}: <span className="font-medium text-gray-900">{value.trim()}</span>
              </span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
});
