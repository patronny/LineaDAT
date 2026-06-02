"use client";

import { useEffect, useState } from "react";
import { BagRow, SwapRow, fetchBags, fetchSwaps, probeIndexer, INDEXER_ENABLED } from "@/lib/indexer";

type State<T> = { data: T[] | null; loading: boolean; error: Error | null; usable: boolean };

const REFETCH_MS = 12_000;

export function useBags(): State<BagRow> {
  const [data, setData] = useState<BagRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [usable, setUsable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function load() {
      try {
        const ok = await probeIndexer();
        if (!ok) {
          if (!cancelled) {
            setUsable(false);
            setLoading(false);
          }
          return;
        }
        if (!cancelled) setUsable(true);
        const rows = await fetchBags();
        if (!cancelled) {
          setData(rows);
          setError(null);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)));
          setLoading(false);
        }
      }
    }

    load();
    if (INDEXER_ENABLED) interval = setInterval(load, REFETCH_MS);
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, []);

  return { data, loading, error, usable };
}

export function useSwaps(limit = 200): State<SwapRow> {
  const [data, setData] = useState<SwapRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [usable, setUsable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function load() {
      try {
        const ok = await probeIndexer();
        if (!ok) {
          if (!cancelled) {
            setUsable(false);
            setLoading(false);
          }
          return;
        }
        if (!cancelled) setUsable(true);
        const rows = await fetchSwaps(limit);
        if (!cancelled) {
          setData(rows);
          setError(null);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)));
          setLoading(false);
        }
      }
    }

    load();
    if (INDEXER_ENABLED) interval = setInterval(load, REFETCH_MS);
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [limit]);

  return { data, loading, error, usable };
}
