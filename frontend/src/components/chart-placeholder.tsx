"use client";

import { Card } from "./ui/card";
import { useStrategyStats } from "@/hooks/useStrategyStats";
import { lineastrPriceInEth } from "@/lib/utils";

/**
 * Chart placeholder — real chart provider (GeckoTerminal embed, DefiLlama price chart, etc.)
 * doesn't list testnet pools. Show current ETH/LINEASTR price + tick + a static notice.
 */
export function ChartPlaceholder() {
  const { data } = useStrategyStats();
  const price = data ? lineastrPriceInEth(data.sqrtPriceX96) : 0;

  return (
    <Card>
      <div className="px-4 sm:px-5 py-3 border-b border-border flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm uppercase tracking-wider">$LINEASTR Chart</h3>
        <span className="text-xs text-muted-foreground font-mono">testnet pool</span>
      </div>
      <div className="p-4 sm:p-6 min-h-[280px] flex flex-col items-center justify-center gap-2 text-center">
        <div className="text-xs text-muted-foreground uppercase tracking-wider">Spot price</div>
        <div className="text-3xl sm:text-4xl font-display font-bold tabular">
          {price > 0 ? (price < 1e-9 ? price.toExponential(2) : price.toFixed(10)) : "—"} ETH
        </div>
        <div className="text-xs text-muted-foreground font-mono">per 1 LINEASTR</div>
        <p className="text-xs text-muted-foreground mt-3 max-w-md leading-relaxed">
          Real-time price chart will be embedded here once the pool is indexed by GeckoTerminal /
          DefiLlama. For now it shows the live spot price derived from <span className="font-mono">slot0.sqrtPriceX96</span>.
        </p>
      </div>
    </Card>
  );
}
