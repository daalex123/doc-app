"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const MAX_RESULTS = 8;

/**
 * Text input with a suggestions dropdown (works with mouse, touch and keyboard; no reliance on
 * the browser's native <datalist>). Stays a plain named input so the visit form posts it as before.
 */
export function MedicineCombobox({
  name,
  value,
  onValueChange,
  options,
  placeholder,
  ariaLabel,
  invalid,
}: {
  name: string;
  value: string;
  /** Called for typing AND for picking a suggestion. */
  onValueChange: (value: string) => void;
  /** Suggestions in priority order (catalog first, then recently prescribed). */
  options: string[];
  placeholder?: string;
  ariaLabel: string;
  invalid?: boolean;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return options.slice(0, MAX_RESULTS);
    const starts: string[] = [];
    const contains: string[] = [];
    for (const o of options) {
      const l = o.toLowerCase();
      if (l === q) continue; // already typed in full
      if (l.startsWith(q)) starts.push(o);
      else if (l.includes(q)) contains.push(o);
    }
    return [...starts, ...contains].slice(0, MAX_RESULTS);
  }, [value, options]);

  const show = open && matches.length > 0;

  const pick = (v: string) => {
    onValueChange(v);
    setOpen(false);
    setActive(-1);
  };

  return (
    <div className="relative">
      <Input
        name={name}
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => {
          if (closeTimer.current) clearTimeout(closeTimer.current);
          setOpen(true);
        }}
        onBlur={() => {
          // delay so a click on a suggestion registers first
          closeTimer.current = setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => (matches.length ? (a + 1) % matches.length : -1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => (matches.length ? (a <= 0 ? matches.length - 1 : a - 1) : -1));
          } else if (e.key === "Enter" && show && active >= 0) {
            e.preventDefault(); // choose the suggestion instead of submitting the form
            pick(matches[active]);
          } else if (e.key === "Escape" && show) {
            e.preventDefault();
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={show && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      {show ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full right-0 left-0 z-50 mt-1 max-h-60 overflow-auto rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-lg"
        >
          {matches.map((m, idx) => (
            <li
              key={m}
              id={`${listId}-${idx}`}
              role="option"
              aria-selected={idx === active}
              // mousedown (not click) so the input keeps focus and blur doesn't close the list first
              onMouseDown={(e) => {
                e.preventDefault();
                pick(m);
              }}
              onMouseEnter={() => setActive(idx)}
              className={cn(
                "cursor-pointer rounded-md px-2.5 py-1.5",
                idx === active ? "bg-accent text-accent-foreground" : "hover:bg-muted",
              )}
            >
              {m}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
