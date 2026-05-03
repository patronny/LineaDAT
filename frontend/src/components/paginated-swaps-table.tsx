"use client";

import { useEffect, useMemo, useState } from "react";
import { usePublicClient } from "wagmi";
import { hookAbi } from "@/lib/abis/swapper";
import { ADDR, txUrl, addressUrl } from "@/lib/wagmi";
import { formatEth, formatTokens, shortAddress, formatTradeDate } from "@/lib/utils";
import { ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";

type SwapRow = {
  side: "buy" | "sell";
  ethAmount: bigint;
  tokenAmount: bigint;
  tx: string;
  block: bigint;
  ts: number;
  origin: string | null;
};

const PAGE_OPTIONS = [10, 20, 30, 40, 50];

export function PaginatedSwapsTable() {
  const client = usePublicClient();
  const [rows, setRows] = useState<SwapRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!client || ADDR.hook === "0x0000000000000000000000000000000000000000") {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    async function fetchSwaps() {
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
        const sorted = [...events].sort((a, b) => Number(b.blockNumber - a.blockNumber));
        const enriched: SwapRow[] = await Promise.all(
          sorted.map(async (e) => {
            const eth = BigInt(e.args.ethAmount as bigint | number);
            const tok = BigInt(e.args.tokenAmount as bigint | number);
            let origin: string | null = null;
            let ts = 0;
            try {
              const [tx, block] = await Promise.all([
                client!.getTransaction({ hash: e.transactionHash }),
                client!.getBlock({ blockHash: e.blockHash }),
              ]);
              origin = tx.from ?? null;
              ts = Number(block.timestamp);
            } catch {
              /* ignore */
            }
            return {
              side: eth > 0n ? ("buy" as const) : ("sell" as const),
              ethAmount: eth < 0n ? -eth : eth,
              tokenAmount: tok < 0n ? -tok : tok,
              tx: e.transactionHash,
              block: e.blockNumber,
              ts,
              origin,
            };
          })
        );
        if (!cancelled) setRows(enriched);
      } catch (err) {
        console.error("PaginatedSwaps fetch failed:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchSwaps();
    const id = setInterval(fetchSwaps, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [client]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const visible = useMemo(
    () => rows.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [rows, safePage, pageSize]
  );

  if (isLoading) {
    return (
      <div className="space-y-2 p-4 sm:p-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center px-4">No swaps yet.</p>;
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
            <tr>
              <th className="text-left py-3 px-4 font-medium">Date</th>
              <th className="text-left py-3 px-4 font-medium">Side</th>
              <th className="text-right py-3 px-4 font-medium">ETH</th>
              <th className="text-right py-3 px-4 font-medium">LINEASTR</th>
              <th className="text-left py-3 px-4 font-medium">Trader</th>
              <th className="text-right py-3 px-4 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((r) => (
              <tr key={r.tx}>
                <td className="py-3 px-4 font-mono text-xs">{formatTradeDate(r.ts)}</td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                      r.side === "buy"
                        ? "bg-green-500/15 text-green-700 dark:text-green-400"
                        : "bg-red-500/15 text-red-700 dark:text-red-400"
                    }`}
                  >
                    {r.side}
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-mono tabular">{formatEth(r.ethAmount)}</td>
                <td className="py-3 px-4 text-right font-mono tabular">{formatTokens(r.tokenAmount)}</td>
                <td className="py-3 px-4">
                  {r.origin ? (
                    <a
                      href={addressUrl(r.origin)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs hover:text-foreground text-muted-foreground"
                    >
                      {shortAddress(r.origin)}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  <a
                    href={txUrl(r.tx)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="md:hidden space-y-2 p-4">
        {visible.map((r) => (
          <li key={r.tx} className="border border-border rounded-md p-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
              <span>{formatTradeDate(r.ts)}</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${
                  r.side === "buy"
                    ? "bg-green-500/15 text-green-700 dark:text-green-400"
                    : "bg-red-500/15 text-red-700 dark:text-red-400"
                }`}
              >
                {r.side}
              </span>
            </div>
            <div className="text-sm font-mono tabular">
              {formatEth(r.ethAmount)} ETH {r.side === "buy" ? "→" : "←"} {formatTokens(r.tokenAmount)} LINEASTR
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {r.origin ? shortAddress(r.origin) : "—"}
            </div>
          </li>
        ))}
      </ul>

      {/* Pagination footer */}
      <div className="border-t border-border px-4 sm:px-5 py-3 flex items-center justify-between text-xs flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Rows</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(parseInt(e.target.value, 10));
              setPage(0);
            }}
            className="bg-secondary border border-border rounded px-2 py-1 font-mono"
          >
            {PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground font-mono">
            Page {safePage + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="p-1.5 rounded border border-border hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="p-1.5 rounded border border-border hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
