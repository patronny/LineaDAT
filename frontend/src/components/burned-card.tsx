"use client";

import { useStrategyStats } from "@/hooks/useStrategyStats";
import { formatTokens } from "@/lib/utils";
import { Flame } from "lucide-react";

/**
 * Burned amount with animated fire backdrop.
 * Three radial-gradient layers + CSS keyframe flicker for that WBTCSTR-style ember glow.
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
    <div className="relative overflow-hidden bg-[#1a0500] p-4 sm:p-5">
      <div className="fire-bg absolute inset-0 pointer-events-none" aria-hidden />
      <div className="fire-bg-2 absolute inset-0 pointer-events-none" aria-hidden />
      <div className="fire-bg-3 absolute inset-x-0 bottom-0 h-2/3 pointer-events-none" aria-hidden />

      <div className="relative z-10 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-95">
          <Flame className="w-3.5 h-3.5 text-orange-300 animate-pulse" />
          $LINEASTR burned
        </div>
        <div className="text-4xl sm:text-5xl font-display font-bold tabular mt-1">{pctStr}</div>
        <div className="text-xs opacity-90 mt-1">of supply</div>
        <div className="text-sm font-mono tabular mt-3">{formatTokens(burned)} tokens</div>
      </div>
    </div>
  );
}
