"use client";

import { ReactNode, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export type SortDir = "asc" | "desc";

/**
 * Tiny generic table-sort hook. Comparators map sort-key -> ascending comparator.
 * Toggle: same key flips dir, new key resets to defaultDir.
 */
export function useTableSort<T>(
  rows: T[],
  defaultKey: string,
  comparators: Record<string, (a: T, b: T) => number>,
  defaultDir: SortDir = "desc"
) {
  const [sortKey, setSortKey] = useState<string>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  const sorted = useMemo(() => {
    const cmp = comparators[sortKey];
    if (!cmp) return rows;
    const out = [...rows].sort(cmp);
    return sortDir === "desc" ? out.reverse() : out;
  }, [rows, sortKey, sortDir, comparators]);

  function toggle(key: string) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(defaultDir);
    }
  }

  return { sorted, sortKey, sortDir, toggle };
}

interface SortHeaderProps {
  field: string;
  active: string;
  dir: SortDir;
  onClick: (field: string) => void;
  align?: "left" | "right";
  children: ReactNode;
}

/**
 * Clickable table-header cell with asc/desc indicator. Inactive headers show a
 * neutral up-down glyph. Active header shows the current direction.
 */
export function SortHeader({ field, active, dir, onClick, align = "left", children }: SortHeaderProps) {
  const isActive = field === active;
  const justify = align === "right" ? "justify-end" : "justify-start";
  const Icon = isActive ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className={`${align === "right" ? "text-right" : "text-left"} py-3 px-4 font-medium`}>
      <button
        type="button"
        onClick={() => onClick(field)}
        className={`inline-flex items-center gap-1.5 ${justify} uppercase tracking-wider transition-colors ${
          isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
        }`}
        aria-label={`Sort by ${typeof children === "string" ? children : field}`}
      >
        <span>{children}</span>
        <Icon
          className={`w-3.5 h-3.5 ${isActive ? "opacity-100" : "opacity-60"}`}
          strokeWidth={2.75}
          aria-hidden
        />
      </button>
    </th>
  );
}
