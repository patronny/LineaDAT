"use client";

import { Card } from "./ui/card";
import { useStrategyStats } from "@/hooks/useStrategyStats";
import { formatEth, formatTokens } from "@/lib/utils";

/**
 * Hero stat tiles — top of strategy page.
 * Mirrors tokenstrategy.com's stat layout: 4 tiles desktop, 2x2 grid on mobile.
 */
export function StrategyStatsHero() {
  const { data, isLoading } = useStrategyStats();

  // Burn percent: dead-address balance / totalSupply (= initial mint, never decreased)
  let burnPercent = "0%";
  if (data && data.totalSupply > 0n) {
    // bps = burned * 10000 / totalSupply, then divide by 100 for percent with 2 decimals
    const bps = Number((data.burned * 10000n) / data.totalSupply);
    burnPercent = bps < 1
      ? "<0.01%"
      : `${(bps / 100).toFixed(bps < 100 ? 2 : 1)}%`;
  }

  const tiles = [
    {
      label: "Available Funds",
      value: data ? `${formatEth(data.availableFunds)} ETH` : "—",
      sub: data ? `Max buy: ${formatEth(data.maxPriceForBuy)} ETH` : "",
    },
    {
      label: "Total Supply",
      value: data ? formatTokens(data.totalSupply) : "—",
      sub: data ? `LINEASTR remaining` : "",
    },
    {
      label: "Treasury (LINEA)",
      value: data ? formatTokens(data.treasuryUnderlying) : "—",
      sub: data ? `Tokens locked in protocol` : "",
    },
    {
      label: "ETH to TWAP",
      value: data ? `${formatEth(data.ethToTwap)} ETH` : "—",
      sub: data ? `Pending burn-and-buyback` : "",
    },
    {
      label: "Burned",
      value: data ? formatTokens(data.burned) : "—",
      sub: data ? `${burnPercent} of supply at 0x…dEaD` : "",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
      {tiles.map((t) => (
        <Card key={t.label} className="stat-tile">
          <div className="stat-label">{t.label}</div>
          <div className={`stat-value ${isLoading ? "animate-pulse opacity-50" : ""}`}>
            {t.value}
          </div>
          <div className="text-xs text-muted-foreground mt-1 hidden sm:block">{t.sub}</div>
        </Card>
      ))}
    </div>
  );
}
