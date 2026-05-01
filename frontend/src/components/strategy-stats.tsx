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
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
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
