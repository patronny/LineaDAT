"use client";

import { useEffect, useState } from "react";

/**
 * Fetches current ETH/USD price from DefiLlama (free, CORS-enabled, no API key).
 * Refreshes every 60s. Falls back to 0 if fetch fails.
 */
export function useEthPrice(): number {
  const [price, setPrice] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function fetchPrice() {
      try {
        const res = await fetch("https://coins.llama.fi/prices/current/coingecko:ethereum");
        if (!res.ok) return;
        const data = await res.json();
        const p = data?.coins?.["coingecko:ethereum"]?.price;
        if (typeof p === "number" && !cancelled) setPrice(p);
      } catch {
        // silent
      }
    }
    fetchPrice();
    const id = setInterval(fetchPrice, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return price;
}
