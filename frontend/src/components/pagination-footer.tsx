"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_OPTIONS = [10, 20, 30, 40, 50];

interface Props {
  page: number;
  pageSize: number;
  totalRows: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (n: number) => void;
}

/**
 * Reusable table pagination footer. Caller is responsible for slicing rows.
 * Footer hides itself entirely when totalRows <= 10 — no controls needed.
 */
export function PaginationFooter({ page, pageSize, totalRows, onPageChange, onPageSizeChange }: Props) {
  if (totalRows <= 10) return null;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(page, totalPages - 1);

  return (
    <div className="border-t border-border px-4 sm:px-5 py-3 flex items-center justify-between text-xs flex-wrap gap-2">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Rows</span>
        <select
          value={pageSize}
          onChange={(e) => {
            onPageSizeChange(parseInt(e.target.value, 10));
            onPageChange(0);
          }}
          className="bg-secondary text-secondary-foreground font-bold border border-border rounded px-2 py-1 font-mono hover:opacity-80 focus-visible:ring-2 focus-visible:ring-primary"
        >
          {PAGE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground font-mono">
          Page {safePage + 1} of {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(Math.max(0, safePage - 1))}
            disabled={safePage === 0}
            className="p-1.5 rounded bg-secondary text-secondary-foreground border border-border hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
          <button
            onClick={() => onPageChange(Math.min(totalPages - 1, safePage + 1))}
            disabled={safePage >= totalPages - 1}
            className="p-1.5 rounded bg-secondary text-secondary-foreground border border-border hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Next page"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Convenience: derive a paginated slice from a flat array.
 */
export function usePagedSlice<T>(rows: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  return rows.slice(safePage * pageSize, safePage * pageSize + pageSize);
}
