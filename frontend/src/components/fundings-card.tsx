"use client";

import { useStrategyStats } from "@/hooks/useStrategyStats";
import { formatEth, formatTokens } from "@/lib/utils";

const BUY_THRESHOLD_WEI = 20000000000000000n; // 0.02 ETH = bot.buyThreshold

function useFundingsData() {
  const { data } = useStrategyStats();
  const currentFees = data?.currentFees ?? 0n;
  const treasuryUnderlying = data?.treasuryUnderlying ?? 0n;
  const bagSize = data?.bagSize ?? 0n;
  const totalSupply = data?.totalSupply ?? 1n;
  const progressPct =
    currentFees >= BUY_THRESHOLD_WEI
      ? 100
      : Math.floor(Number((currentFees * 10000n) / BUY_THRESHOLD_WEI)) / 100;
  const supplyPct =
    totalSupply > 0n ? (Number((bagSize * 10000n) / totalSupply) / 100).toFixed(2) : "0.00";
  return { currentFees, treasuryUnderlying, bagSize, progressPct, supplyPct };
}

/**
 * "$LINEASTR is currently holding X ETH ↳ Y tLINEA in treasury"
 */
export function FundingsCard() {
  const { currentFees, treasuryUnderlying } = useFundingsData();
  return (
    <div className="p-4 sm:p-5">
      <div className="text-xs text-muted-foreground">$LINEASTR is currently holding</div>
      <div className="text-3xl font-display font-bold mt-1 tabular">{formatEth(currentFees)} ETH</div>
      <div className="text-xs text-muted-foreground font-mono mt-1">
        ↳ {formatTokens(treasuryUnderlying)} tLINEA in treasury
      </div>
    </div>
  );
}

/**
 * "Bot is trying to buy 150,000 tLINEA — N% of supply, current bid X ETH"
 */
export function BotIntentCard() {
  const { currentFees, bagSize, supplyPct } = useFundingsData();
  return (
    <div className="p-4 sm:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs text-muted-foreground leading-snug">
          Bot is trying to buy
          <br />
          <span className="font-mono">{formatTokens(bagSize)} tLINEA</span>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>{supplyPct}%</div>
          <div>of supply</div>
        </div>
      </div>
      <div className="text-3xl font-display font-bold tabular">{formatTokens(bagSize)} tLINEA</div>
      <div className="border-t border-border pt-3 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Current bid</span>
        <span className="font-mono tabular">{formatEth(currentFees)} ETH</span>
      </div>
    </div>
  );
}

/**
 * "X% Progress — toward market price for next bag" with progress bar.
 */
export function ProgressCard() {
  const { progressPct } = useFundingsData();
  return (
    <div className="p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3 text-xs mb-2 flex-wrap">
        <span className="font-semibold whitespace-nowrap">{progressPct.toFixed(1)}% Progress</span>
        <span className="text-muted-foreground text-right">toward market price for next bag</span>
      </div>
      <div className="h-3 bg-secondary/30 rounded overflow-hidden">
        <div
          className="h-full bg-secondary transition-all"
          style={{ width: `${Math.min(progressPct, 100)}%` }}
        />
      </div>
    </div>
  );
}
