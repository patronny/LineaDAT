"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { strategyAbi } from "@/lib/abis/strategy";
import { useStrategyStats } from "@/hooks/useStrategyStats";
import { ADDR, txUrl } from "@/lib/wagmi";
import { formatEth, formatTokens, formatTradeDate } from "@/lib/utils";
import { ExternalLink } from "lucide-react";
import { PaginationFooter, usePagedSlice } from "./pagination-footer";

type SaleRow = {
  bagId: bigint;
  soldFor: bigint;        // SoldByProtocol price
  paidByBot: bigint;      // BoughtByProtocol purchasePrice for the same bagId
  block: bigint;
  ts: number;
  tx: string;
};

/**
 * Sales table — past bag sales (SoldByProtocol joined with BoughtByProtocol for the same bagId
 * to compute profit). Columns: Date | tLINEA | Paid | Sold For | Profit.
 */
export function SalesTable() {
  const client = usePublicClient();
  const { data: stats } = useStrategyStats();
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!client || ADDR.strategy === "0x0000000000000000000000000000000000000000") {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    async function fetchSales() {
      try {
        const latest = await client!.getBlockNumber();
        const fromBlock = latest > 5_000n ? latest - 5_000n : 0n;
        const [bought, sold] = await Promise.all([
          client!.getContractEvents({
            address: ADDR.strategy,
            abi: strategyAbi,
            eventName: "ERC20BoughtByProtocol",
            fromBlock,
            toBlock: latest,
          }),
          client!.getContractEvents({
            address: ADDR.strategy,
            abi: strategyAbi,
            eventName: "ERC20SoldByProtocol",
            fromBlock,
            toBlock: latest,
          }),
        ]);

        const paidByBag = new Map<string, bigint>();
        for (const e of bought) {
          paidByBag.set(String(e.args.bagId as bigint), e.args.purchasePrice as bigint);
        }

        const enriched: SaleRow[] = await Promise.all(
          sold.map(async (e) => {
            const block = await client!.getBlock({ blockHash: e.blockHash });
            const bagId = e.args.bagId as bigint;
            return {
              bagId,
              soldFor: e.args.price as bigint,
              paidByBot: paidByBag.get(String(bagId)) ?? 0n,
              block: e.blockNumber,
              ts: Number(block.timestamp),
              tx: e.transactionHash,
            };
          })
        );

        if (!cancelled) {
          setRows(enriched.sort((a, b) => Number(b.block - a.block)));
        }
      } catch (err) {
        console.error("Sales fetch failed:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchSales();
    const id = setInterval(fetchSales, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [client]);

  const bagSize = stats?.bagSize ?? 0n;
  const visible = usePagedSlice(rows, page, pageSize);

  if (isLoading) {
    return (
      <div className="space-y-2 p-4 sm:p-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center px-4">
        No bags sold yet. Bags appear here once buyers redeem listed bags.
      </p>
    );
  }

  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
            <tr>
              <th className="text-left py-3 px-4 font-medium">Date</th>
              <th className="text-left py-3 px-4 font-medium">tLINEA</th>
              <th className="text-left py-3 px-4 font-medium">Paid</th>
              <th className="text-left py-3 px-4 font-medium">Sold For</th>
              <th className="text-left py-3 px-4 font-medium">Profit</th>
              <th className="text-right py-3 px-4 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((r) => {
              const profit = r.soldFor - r.paidByBot;
              const profitPositive = profit >= 0n;
              return (
                <tr key={`${String(r.bagId)}-${r.tx}`}>
                  <td className="py-3 px-4 font-mono text-xs">{formatTradeDate(r.ts)}</td>
                  <td className="py-3 px-4 font-mono tabular">{formatTokens(bagSize)}</td>
                  <td className="py-3 px-4 font-mono tabular">{formatEth(r.paidByBot)} ETH</td>
                  <td className="py-3 px-4 font-mono tabular">{formatEth(r.soldFor)} ETH</td>
                  <td
                    className={`py-3 px-4 font-mono tabular font-semibold ${
                      profitPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {profitPositive ? "+" : ""}
                    {formatEth(profit < 0n ? -profit : profit)} ETH
                  </td>
                  <td className="py-3 px-4 text-right">
                    <a
                      href={txUrl(r.tx)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden space-y-2 p-4">
        {visible.map((r) => {
          const profit = r.soldFor - r.paidByBot;
          const profitPositive = profit >= 0n;
          return (
            <li key={`${String(r.bagId)}-${r.tx}`} className="border border-border rounded-md p-3 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                <span>{formatTradeDate(r.ts)}</span>
                <span>Bag #{String(r.bagId)}</span>
              </div>
              <div className="text-sm font-mono tabular">
                Paid {formatEth(r.paidByBot)} → sold {formatEth(r.soldFor)} ETH
              </div>
              <div
                className={`text-sm font-mono tabular font-semibold ${
                  profitPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {profitPositive ? "+" : ""}
                {formatEth(profit < 0n ? -profit : profit)} ETH profit
              </div>
            </li>
          );
        })}
      </ul>
      <PaginationFooter
        page={page}
        pageSize={pageSize}
        totalRows={rows.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </>
  );
}
