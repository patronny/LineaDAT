"use client";

import { useEffect, useState } from "react";
import { fetchOldestSwapSince, INDEXER_ENABLED } from "@/lib/indexer";
import { lineastrPriceInEth } from "@/lib/utils";

/**
 * 24h LINEASTR price change in percent vs the price 24 hours ago.
 *
 * Baseline = sqrtPriceX96 of the earliest swap with timestamp >= now-24h
 * (queried from the Ponder indexer). Current = sqrtPriceX96 from the live
 * pool (passed in by caller — usually `useStrategyStats().sqrtPriceX96`).
 *
 * Returns null when:
 *   - indexer disabled / down
 *   - no swap exists in the last 24h (nothing to anchor against)
 *   - current sqrtPriceX96 is unavailable
 */
export function usePriceChange24h(currentSqrtPriceX96: bigint | undefined): number | null {
  const [pct, setPct] = useState<number | null>(null);

  useEffect(() => {
    if (!INDEXER_ENABLED || !currentSqrtPriceX96 || currentSqrtPriceX96 === 0n) {
      setPct(null);
      return;
    }
    const ctrl = new AbortController();
    let cancelled = false;
    async function run() {
      try {
        const since = Math.floor(Date.now() / 1000) - 86400;
        const baseline = await fetchOldestSwapSince(since, ctrl.signal);
        if (cancelled) return;
        if (!baseline) {
          setPct(null);
          return;
        }
        const baselinePrice = lineastrPriceInEth(BigInt(baseline.sqrtPriceX96));
        const currentPrice = lineastrPriceInEth(currentSqrtPriceX96);
        if (baselinePrice <= 0 || currentPrice <= 0) {
          setPct(null);
          return;
        }
        setPct(((currentPrice - baselinePrice) / baselinePrice) * 100);
      } catch {
        if (!cancelled) setPct(null);
      }
    }
    run();
    const id = setInterval(run, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
      ctrl.abort();
    };
  }, [currentSqrtPriceX96]);

  return pct;
}
