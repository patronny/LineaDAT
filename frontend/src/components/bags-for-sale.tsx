"use client";

import { useState } from "react";
import { useReadContracts, useWriteContract, useAccount } from "wagmi";
import { strategyAbi } from "@/lib/abis/strategy";
import { ADDR } from "@/lib/wagmi";
import { useStrategyStats } from "@/hooks/useStrategyStats";
import { formatEth, formatTokens } from "@/lib/utils";
import { Button } from "./ui/button";

/**
 * Lists all bags currently `onSale` (listPrice > 0) and lets users buy them with ETH.
 * Mobile: card-stack layout. Desktop: table.
 */
export function BagsForSaleClient() {
  const { data: stats } = useStrategyStats();
  const { isConnected } = useAccount();
  const lastBagId = stats?.lastBagId ?? 0n;

  // Pull onSale[bagId] for the most recent ~20 bags
  const SCAN_DEPTH = 20n;
  const startId = lastBagId > SCAN_DEPTH ? lastBagId - SCAN_DEPTH + 1n : 1n;
  const bagIds: bigint[] = [];
  for (let i = startId; i <= lastBagId; i++) bagIds.push(i);

  const { data: priceData } = useReadContracts({
    contracts: bagIds.map((id) => ({
      address: ADDR.strategy,
      abi: strategyAbi,
      functionName: "onSale" as const,
      args: [id],
    })),
    query: {
      refetchInterval: 12_000,
      enabled: lastBagId > 0n && ADDR.strategy !== "0x0000000000000000000000000000000000000000",
    },
  });

  const sellable = bagIds
    .map((id, idx) => ({
      id,
      price: (priceData?.[idx]?.result as bigint | undefined) ?? 0n,
    }))
    .filter((b) => b.price > 0n)
    .reverse();

  if (lastBagId === 0n) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No bags created yet. Bot will buy the first bag when fees accumulate.
      </p>
    );
  }
  if (sellable.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        All recent bags have been sold. Check back after the bot creates a new one.
      </p>
    );
  }

  return (
    <>
      {/* Mobile: card stack */}
      <div className="md:hidden space-y-3">
        {sellable.map((bag) => (
          <BagCardMobile key={String(bag.id)} bagId={bag.id} price={bag.price} bagSize={stats?.bagSize ?? 0n} disabled={!isConnected} />
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
              <th className="pb-3 font-medium">Bag #</th>
              <th className="pb-3 font-medium">Contains</th>
              <th className="pb-3 font-medium">Price</th>
              <th className="pb-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sellable.map((bag) => (
              <BagRowDesktop
                key={String(bag.id)}
                bagId={bag.id}
                price={bag.price}
                bagSize={stats?.bagSize ?? 0n}
                disabled={!isConnected}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function BagRowDesktop({ bagId, price, bagSize, disabled }: { bagId: bigint; price: bigint; bagSize: bigint; disabled: boolean }) {
  const { writeContract, isPending } = useWriteContract();

  function handleBuy() {
    writeContract({
      address: ADDR.strategy,
      abi: strategyAbi,
      functionName: "sellTokens",
      args: [bagId],
      value: price,
    });
  }

  return (
    <tr>
      <td className="py-3 font-mono text-sm">#{String(bagId)}</td>
      <td className="py-3 tabular">{formatTokens(bagSize)} tLINEA</td>
      <td className="py-3 tabular font-mono">{formatEth(price)} ETH</td>
      <td className="py-3 text-right">
        <Button size="sm" onClick={handleBuy} disabled={disabled || isPending}>
          {isPending ? "Buying..." : "Buy bag"}
        </Button>
      </td>
    </tr>
  );
}

function BagCardMobile({ bagId, price, bagSize, disabled }: { bagId: bigint; price: bigint; bagSize: bigint; disabled: boolean }) {
  const { writeContract, isPending } = useWriteContract();

  function handleBuy() {
    writeContract({
      address: ADDR.strategy,
      abi: strategyAbi,
      functionName: "sellTokens",
      args: [bagId],
      value: price,
    });
  }

  return (
    <div className="rounded-lg border border-border p-4 flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">Bag #{String(bagId)}</div>
        <div className="font-display font-semibold mt-0.5">
          {formatTokens(bagSize)} tLINEA
        </div>
        <div className="text-sm tabular font-mono mt-1">
          {formatEth(price)} ETH
        </div>
      </div>
      <Button size="sm" onClick={handleBuy} disabled={disabled || isPending}>
        {isPending ? "..." : "Buy"}
      </Button>
    </div>
  );
}
