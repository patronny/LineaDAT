"use client";

import { Card } from "./ui/card";
import { useStrategyStats } from "@/hooks/useStrategyStats";
import { formatTokens } from "@/lib/utils";

/**
 * Burned amount card — orange/red gradient with big % + raw token count.
 * Mirrors the "Burned Amount" panel from the tokenstrategy.com reference.
 */
export function BurnedCard() {
  const { data } = useStrategyStats();
  const burned = data?.burned ?? 0n;
  const totalSupply = data?.totalSupply ?? 0n;

  let pctStr = "0.00%";
  if (totalSupply > 0n) {
    const bps = Number((burned * 10000n) / totalSupply);
    pctStr = bps < 1 ? "<0.01%" : `${(bps / 100).toFixed(2)}%`;
  }

  return (
    <Card className="overflow-hidden relative bg-gradient-to-br from-orange-600 to-red-700 text-white border-orange-700">
      <div className="px-4 sm:px-5 py-3 border-b border-white/20 flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm uppercase tracking-wider">Burned Amount</h3>
      </div>
      <div className="p-4 sm:p-5">
        <div className="text-xs uppercase tracking-wider opacity-90">$LINEASTR burned</div>
        <div className="text-4xl sm:text-5xl font-display font-bold tabular mt-1">{pctStr}</div>
        <div className="text-xs opacity-80 mt-1">of supply</div>
        <div className="text-sm font-mono tabular mt-3">{formatTokens(burned)} tokens</div>
      </div>
    </Card>
  );
}
