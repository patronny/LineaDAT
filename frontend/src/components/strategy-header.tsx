"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { Card } from "./ui/card";
import { useStrategyStats } from "@/hooks/useStrategyStats";
import { hookAbi } from "@/lib/abis/swapper";
import { ADDR } from "@/lib/wagmi";
import { lineastrPriceInEth } from "@/lib/utils";

/**
 * Big strategy header card matching tokenstrategy.com reference.
 * Logo + name + chain badge + inline mini-stats (price / MC / MC incl burns / 24h Vol / 24h Change).
 */
export function StrategyHeader() {
  const { data } = useStrategyStats();
  const client = usePublicClient();
  const [vol24h, setVol24h] = useState<bigint>(0n);

  // Aggregate ETH-side volume from hook Trade events (last 5000 blocks ≈ 3h, capped by drpc).
  useEffect(() => {
    if (!client || ADDR.hook === "0x0000000000000000000000000000000000000000") return;
    let cancelled = false;
    async function fetch() {
      try {
        const latest = await client!.getBlockNumber();
        const fromBlock = latest > 5_000n ? latest - 5_000n : 0n;
        const events = await client!.getContractEvents({
          address: ADDR.hook,
          abi: hookAbi,
          eventName: "Trade",
          args: { strategy: ADDR.strategy },
          fromBlock,
          toBlock: latest,
        });
        let total = 0n;
        for (const e of events) {
          const eth = BigInt(e.args.ethAmount as bigint | number);
          total += eth < 0n ? -eth : eth;
        }
        if (!cancelled) setVol24h(total);
      } catch {
        // silent — leave volume at 0
      }
    }
    fetch();
    const id = setInterval(fetch, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [client]);

  const pricePerLineastr = data ? lineastrPriceInEth(data.sqrtPriceX96) : 0;
  const totalSupplyFloat = data ? Number(data.totalSupply) / 1e18 : 0;
  const burnedFloat = data ? Number(data.burned) / 1e18 : 0;
  const marketCapEth = pricePerLineastr * (totalSupplyFloat - burnedFloat);
  const marketCapInclBurnsEth = pricePerLineastr * totalSupplyFloat;

  const fmt = (n: number, max = 6) =>
    n === 0 ? "—" : n < 1e-9 ? n.toExponential(2) : n.toFixed(max);

  return (
    <Card className="mb-4 sm:mb-6">
      <div className="p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8">
        {/* Logo + name */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-2xl font-bold text-primary-foreground">
            L
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold leading-tight">
              LineaStrategy
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
              <span className="text-muted-foreground font-mono">$LINEASTR</span>
              <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border font-mono uppercase tracking-wider">
                ERC-20 on
              </span>
              <span className="text-muted-foreground">Base Sepolia</span>
            </div>
          </div>
        </div>

        {/* Inline stats — desktop horizontal, mobile 2-col grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-1 lg:justify-end gap-3 sm:gap-6 text-xs lg:text-sm">
          <Stat label="$LINEASTR" value={pricePerLineastr ? `${fmt(pricePerLineastr, 8)} ETH` : "—"} />
          <Stat label="Market Cap" value={marketCapEth ? `${fmt(marketCapEth, 4)} ETH` : "—"} />
          <Stat label="MC incl burns" value={marketCapInclBurnsEth ? `${fmt(marketCapInclBurnsEth, 4)} ETH` : "—"} />
          <Stat label="3h Volume" value={vol24h > 0n ? `${(Number(vol24h) / 1e18).toFixed(4)} ETH` : "—"} />
          <Stat label="3h Change" value="—" muted />
        </div>
      </div>
    </Card>
  );
}

function Stat({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="lg:text-right">
      <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-mono tabular text-sm sm:text-base font-semibold ${muted ? "text-muted-foreground" : ""}`}>
        {value}
      </div>
    </div>
  );
}
