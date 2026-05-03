"use client";

import { useStrategyStats } from "@/hooks/useStrategyStats";
import { formatTokens } from "@/lib/utils";

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
    <div className="p-4 sm:p-5 bg-gradient-to-br from-orange-600 to-red-700 text-white">
      <div className="text-xs uppercase tracking-wider opacity-90">$LINEASTR burned</div>
      <div className="text-4xl sm:text-5xl font-display font-bold tabular mt-1">{pctStr}</div>
      <div className="text-xs opacity-80 mt-1">of supply</div>
      <div className="text-sm font-mono tabular mt-3">{formatTokens(burned)} tokens</div>
    </div>
  );
}
