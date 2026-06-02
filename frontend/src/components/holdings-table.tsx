"use client";

import { useEffect, useState } from "react";
import { usePublicClient, useReadContracts, useWaitForTransactionReceipt, useWriteContract, useAccount } from "wagmi";
import { strategyAbi } from "@/lib/abis/strategy";
import { useStrategyStats } from "@/hooks/useStrategyStats";
import { useBags } from "@/hooks/useIndexer";
import { ADDR, UNDERLYING_SYMBOL } from "@/lib/wagmi";
import { formatEth, formatTokens, formatTradeDate, getEventsChunked } from "@/lib/utils";
import { Button } from "./ui/button";
import { PaginationFooter, usePagedSlice } from "./pagination-footer";
import { SortHeader, useTableSort } from "./ui/sort-header";

export type BagRow = {
  bagId: bigint;
  paid: bigint;        // bot paid this much ETH for the bag
  listPrice: bigint;   // currently listed at this price
  block: bigint;
  ts: number;          // unix seconds
};

/**
 * Hook: live unsold bag rows shared between HoldingsTable and the dashboard
 * summary line in the card title. Indexer-first with on-chain getLogs fallback.
 */
export function useHoldingsRows(): { rows: BagRow[]; isLoading: boolean } {
  const client = usePublicClient();
  const indexer = useBags();
  const [rows, setRows] = useState<BagRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (indexer.usable && indexer.data) {
      const bags = indexer.data
        .filter((b) => b.soldAt === null && BigInt(b.paid) > 0n)
        .map((b) => ({
          bagId: BigInt(b.bagId),
          paid: BigInt(b.paid),
          listPrice: BigInt(b.listPrice),
          block: BigInt(b.blockNumber),
          ts: b.timestamp,
        }));
      setRows(bags);
      setIsLoading(false);
      return;
    }
    if (indexer.loading) return;
    if (!client || ADDR.strategy === "0x0000000000000000000000000000000000000000") {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    async function fetchBags() {
      try {
        const events = await getEventsChunked(client!, {
          address: ADDR.strategy,
          abi: strategyAbi,
          eventName: "ERC20BoughtByProtocol",
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
        if (!cancelled) setRows(enriched);
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
  }, [client, indexer.usable, indexer.loading, indexer.data]);

  return { rows, isLoading };
}

/**
 * Aggregate live unsold-bag totals: count, total underlying tokens, total paid (ETH),
 * total listed-at (ETH). Fed by the same data path as HoldingsTable, plus live
 * onSale[bagId] reads to reflect bags that have already been sold.
 */
export function useHoldingsTotals(): {
  count: number;
  totalTokens: bigint;
  totalPaid: bigint;
  totalListed: bigint;
} {
  const { data: stats } = useStrategyStats();
  const { rows } = useHoldingsRows();
  const { data: onSaleData } = useReadContracts({
    contracts: rows.map((r) => ({
      address: ADDR.strategy,
      abi: strategyAbi,
      functionName: "onSale" as const,
      args: [r.bagId],
    })),
    query: { enabled: rows.length > 0, refetchInterval: 12_000 },
  });

  const live = rows
    .map((r, idx) => {
      const livePrice = (onSaleData?.[idx]?.result as bigint | undefined) ?? r.listPrice;
      return { ...r, listPrice: livePrice };
    })
    .filter((r) => r.listPrice > 0n);

  const bagSize = stats?.bagSize ?? 0n;
  return {
    count: live.length,
    totalTokens: bagSize * BigInt(live.length),
    totalPaid: live.reduce((acc, r) => acc + r.paid, 0n),
    totalListed: live.reduce((acc, r) => acc + r.listPrice, 0n),
  };
}

/**
 * Holdings table - bags currently for sale (BoughtByProtocol events whose listPrice still > 0).
 * Columns: Date | tLINEA | Paid | Listed At | Buy. Mirrors tokenstrategy.com reference.
 */
export function HoldingsTable() {
  const { data: stats } = useStrategyStats();
  const { isConnected } = useAccount();
  // Same double-spend trap as swap-card: wagmi `isPending` only stays true while
  // the wallet popup is open. Wait for the receipt before re-enabling buttons.
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });
  const txBusy = isPending || isConfirming;
  const { rows, isLoading } = useHoldingsRows();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const { data: onSaleData } = useReadContracts({
    contracts: rows.map((r) => ({
      address: ADDR.strategy,
      abi: strategyAbi,
      functionName: "onSale" as const,
      args: [r.bagId],
    })),
    query: { enabled: rows.length > 0, refetchInterval: 12_000 },
  });

  const liveRows = rows
    .map((r, idx) => {
      const livePrice = (onSaleData?.[idx]?.result as bigint | undefined) ?? r.listPrice;
      return { ...r, listPrice: livePrice };
    })
    .filter((r) => r.listPrice > 0n);

  const cmpBigint = (x: bigint, y: bigint) => (x < y ? -1 : x > y ? 1 : 0);
  const { sorted, sortKey, sortDir, toggle } = useTableSort(liveRows, "date", {
    date: (a, b) => a.ts - b.ts,
    paid: (a, b) => cmpBigint(a.paid, b.paid),
    listed: (a, b) => cmpBigint(a.listPrice, b.listPrice),
  });

  const visible = usePagedSlice(sorted, page, pageSize);

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
        No bags listed for sale right now.
      </p>
    );
  }

  return (
    <>
      {/* Desktop / tablet: full table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b border-border">
            <tr>
              <SortHeader field="date" active={sortKey} dir={sortDir} onClick={toggle}>Date</SortHeader>
              <th className="text-left py-3 px-4 font-medium uppercase tracking-wider">{UNDERLYING_SYMBOL}</th>
              <SortHeader field="paid" active={sortKey} dir={sortDir} onClick={toggle}>Paid</SortHeader>
              <SortHeader field="listed" active={sortKey} dir={sortDir} onClick={toggle}>Listed At</SortHeader>
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
                    disabled={!isConnected || txBusy}
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
        {sorted.map((r) => (
          <li key={String(r.bagId)} className="border border-border rounded-md p-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
              <span>{formatTradeDate(r.ts)}</span>
              <span>Bag #{String(r.bagId)}</span>
            </div>
            <div className="text-sm font-mono tabular">
              {formatTokens(bagSize)} {UNDERLYING_SYMBOL} - paid {formatEth(r.paid)} ETH
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold tabular">{formatEth(r.listPrice)} ETH</span>
              <Button size="sm" onClick={() => buy(r.bagId, r.listPrice)} disabled={!isConnected || txBusy}>
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
