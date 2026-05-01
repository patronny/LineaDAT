"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { strategyAbi } from "@/lib/abis/strategy";
import { ADDR, txUrl } from "@/lib/wagmi";
import { formatEth, formatTokens, shortAddress } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

type Activity =
  | { kind: "BoughtByProtocol"; bagId: bigint; paid: bigint; listPrice: bigint; tx: string; block: bigint }
  | { kind: "SoldByProtocol"; bagId: bigint; price: bigint; buyer: string; tx: string; block: bigint }
  | { kind: "BoughtAndBurned"; amount0: bigint; amount1: bigint; tx: string; block: bigint };

/**
 * Fetches the last ~50 strategy events and renders them as a chronological feed.
 * Mobile: stacked cards. Desktop: timeline-style list.
 */
export function ActivityFeedClient() {
  const client = usePublicClient();
  const [items, setItems] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!client || ADDR.strategy === "0x0000000000000000000000000000000000000000") {
      setIsLoading(false);
      return;
    }

    async function fetchEvents() {
      try {
        const latest = await client!.getBlockNumber();
        const fromBlock = latest > 50_000n ? latest - 50_000n : 0n;

        const [bought, sold, burned] = await Promise.all([
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
          client!.getContractEvents({
            address: ADDR.strategy,
            abi: strategyAbi,
            eventName: "BoughtAndBurned",
            fromBlock,
            toBlock: latest,
          }),
        ]);

        const all: Activity[] = [];
        for (const e of bought) {
          all.push({
            kind: "BoughtByProtocol",
            bagId: e.args.bagId as bigint,
            paid: e.args.purchasePrice as bigint,
            listPrice: e.args.listPrice as bigint,
            tx: e.transactionHash,
            block: e.blockNumber,
          });
        }
        for (const e of sold) {
          all.push({
            kind: "SoldByProtocol",
            bagId: e.args.bagId as bigint,
            price: e.args.price as bigint,
            buyer: e.args.buyer as string,
            tx: e.transactionHash,
            block: e.blockNumber,
          });
        }
        for (const e of burned) {
          all.push({
            kind: "BoughtAndBurned",
            amount0: e.args.amount0 as bigint,
            amount1: e.args.amount1 as bigint,
            tx: e.transactionHash,
            block: e.blockNumber,
          });
        }
        all.sort((a, b) => Number(b.block - a.block));
        setItems(all.slice(0, 50));
      } catch (err) {
        console.error("Activity fetch failed:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchEvents();
    const interval = setInterval(fetchEvents, 30_000);
    return () => clearInterval(interval);
  }, [client]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No activity yet.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((item, idx) => (
        <li key={`${item.tx}-${idx}`} className="py-3 flex items-start gap-3">
          <div className="flex-shrink-0 w-2 h-2 rounded-full mt-2 bg-primary" />
          <div className="flex-1 min-w-0">
            <ActivityRow item={item} />
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="font-mono">block #{String(item.block)}</span>
              <a
                href={txUrl(item.tx)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <ExternalLink className="w-3 h-3" />
                tx
              </a>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ActivityRow({ item }: { item: Activity }) {
  if (item.kind === "BoughtByProtocol") {
    return (
      <p className="text-sm">
        <span className="font-semibold">Bag #{String(item.bagId)} bought</span> by bot for{" "}
        <span className="font-mono tabular">{formatEth(item.paid)} ETH</span> — listed at{" "}
        <span className="font-mono tabular">{formatEth(item.listPrice)} ETH</span>
      </p>
    );
  }
  if (item.kind === "SoldByProtocol") {
    return (
      <p className="text-sm">
        <span className="font-semibold">Bag #{String(item.bagId)} sold</span> to{" "}
        <span className="font-mono">{shortAddress(item.buyer)}</span> for{" "}
        <span className="font-mono tabular">{formatEth(item.price)} ETH</span>
      </p>
    );
  }
  return (
    <p className="text-sm">
      <span className="font-semibold">Burn:</span> bought and burned{" "}
      <span className="font-mono tabular">{formatTokens(item.amount1 < 0n ? -item.amount1 : item.amount1)} LINEASTR</span>
    </p>
  );
}
