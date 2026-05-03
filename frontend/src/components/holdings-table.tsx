"use client";

import { useEffect, useState } from "react";
import { usePublicClient, useReadContracts, useWriteContract, useAccount } from "wagmi";
import { strategyAbi } from "@/lib/abis/strategy";
import { useStrategyStats } from "@/hooks/useStrategyStats";
import { ADDR } from "@/lib/wagmi";
import { formatEth, formatTokens, formatTradeDate } from "@/lib/utils";
import { Button } from "./ui/button";
import { PaginationFooter, usePagedSlice } from "./pagination-footer";

type BagRow = {
  bagId: bigint;
  paid: bigint;        // bot paid this much ETH for the bag
  listPrice: bigint;   // currently listed at this price
  block: bigint;
  ts: number;          // unix seconds
};

/**
 * Holdings table — bags currently for sale (BoughtByProtocol events whose listPrice still > 0).
 * Columns: Date | tLINEA | Paid | Listed At | Buy. Mirrors tokenstrategy.com reference.
 */
export function HoldingsTable() {
  const client = usePublicClient();
  const { data: stats } = useStrategyStats();
  const { isConnected } = useAccount();
  const { writeContract, isPending } = useWriteContract();
  const [rows, setRows] = useState<BagRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!client || ADDR.strategy === "0x0000000000000000000000000000000000000000") {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    async function fetchBags() {
      try {
        const latest = await client!.getBlockNumber();
        const fromBlock = latest > 5_000n ? latest - 5_000n : 0n;
        const events = await client!.getContractEvents({
          address: ADDR.strategy,
          abi: strategyAbi,
          eventName: "ERC20BoughtByProtocol",
          fromBlock,
          toBlock: latest,
        });
        const enriched: BagRow[] = await Promise.all(
          events.map(async (e) => {
            const block = await client!.getBlock({ blockHash: e.blockHash });
            return {
              bagId: e.args.bagId as bigint,
              paid: e.args.purchasePrice as bigint,
              listPrice: e.args.listPrice as bigint,
              block: e.blockNumber,
              ts: Number(block.timestamp),
            };
          })
        );
        if (!cancelled) {
          setRows(enriched.sort((a, b) => Number(b.block - a.block)));
        }
      } catch (err) {
        console.error("Holdings fetch failed:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchBags();
    const id = setInterval(fetchBags, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [client]);

  // Live onSale[bagId] reads — filter rows where listPrice still > 0
  const { data: onSaleData } = useReadContracts({
    contracts: rows.map((r) => ({
      address: ADDR.strategy,
      abi: strategyAbi,
      functionName: "onSale" as const,
      args: [r.bagId],
    })),
    query: {
      enabled: rows.length > 0,
      refetchInterval: 12_000,
    },
  });

  const liveRows = rows
    .map((r, idx) => {
      const livePrice = (onSaleData?.[idx]?.result as bigint | undefined) ?? r.listPrice;
      return { ...r, listPrice: livePrice };
    })
    .filter((r) => r.listPrice > 0n);

  const visible = usePagedSlice(liveRows, page, pageSize);

  function buy(bagId: bigint, price: bigint) {
    writeContract({
      address: ADDR.strategy,
      abi: strategyAbi,
      functionName: "sellTokens",
      args: [bagId],
      value: price,
    });
  }

  const bagSize = stats?.bagSize ?? 0n;

  if (isLoading) {
    return (
      <div className="space-y-2 p-4 sm:p-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (liveRows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center px-4">
        No bags listed for sale right now. Bot lists a new bag whenever currentFees ≥ 0.02 ETH.
      </p>
    );
  }

  return (
    <>
      {/* Desktop / tablet: full table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
            <tr>
              <th className="text-left py-3 px-4 font-medium">Date</th>
              <th className="text-left py-3 px-4 font-medium">tLINEA</th>
              <th className="text-left py-3 px-4 font-medium">Paid</th>
              <th className="text-left py-3 px-4 font-medium">Listed At</th>
              <th className="text-right py-3 px-4 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((r) => (
              <tr key={String(r.bagId)}>
                <td className="py-3 px-4 font-mono text-xs">{formatTradeDate(r.ts)}</td>
                <td className="py-3 px-4 font-mono tabular">{formatTokens(bagSize)}</td>
                <td className="py-3 px-4 font-mono tabular">{formatEth(r.paid)} ETH</td>
                <td className="py-3 px-4 font-mono tabular">{formatEth(r.listPrice)} ETH</td>
                <td className="py-3 px-4 text-right">
                  <Button
                    size="sm"
                    onClick={() => buy(r.bagId, r.listPrice)}
                    disabled={!isConnected || isPending}
                  >
                    Buy
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <ul className="md:hidden space-y-2 p-4">
        {liveRows.map((r) => (
          <li key={String(r.bagId)} className="border border-border rounded-md p-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
              <span>{formatTradeDate(r.ts)}</span>
              <span>Bag #{String(r.bagId)}</span>
            </div>
            <div className="text-sm font-mono tabular">
              {formatTokens(bagSize)} tLINEA — paid {formatEth(r.paid)} ETH
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold tabular">{formatEth(r.listPrice)} ETH</span>
              <Button size="sm" onClick={() => buy(r.bagId, r.listPrice)} disabled={!isConnected || isPending}>
                Buy
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <PaginationFooter
        page={page}
        pageSize={pageSize}
        totalRows={liveRows.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </>
  );
}
