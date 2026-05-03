"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { strategyAbi } from "@/lib/abis/strategy";
import { ADDR, txUrl, addressUrl } from "@/lib/wagmi";
import { formatEth, formatTokens, shortAddress } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

type BagEvent =
  | { kind: "Created"; bagId: bigint; paid: bigint; listPrice: bigint; tx: string; block: bigint }
  | { kind: "Purchased"; bagId: bigint; price: bigint; buyer: string; tx: string; block: bigint };

/**
 * "Buy bags" feed — bag lifecycle only:
 *   - Created: bot.executeRound bought a fresh bag of tLINEA at price X, listed at 1.2× X
 *   - Purchased: a user redeemed a listed bag for ETH at price Y
 *
 * Generic Uniswap swaps live in the SwapHistoryTable below.
 */
export function ActivityFeedClient() {
  const client = usePublicClient();
  const [items, setItems] = useState<BagEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!client || ADDR.strategy === "0x0000000000000000000000000000000000000000") {
      setIsLoading(false);
      return;
    }

    async function fetchEvents() {
      try {
        const latest = await client!.getBlockNumber();
        // drpc.org free tier limits getLogs to 10k blocks. 5k = ~3h on Base Sepolia.
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

        const all: BagEvent[] = [];
        for (const e of bought) {
          all.push({
            kind: "Created",
            bagId: e.args.bagId as bigint,
            paid: e.args.purchasePrice as bigint,
            listPrice: e.args.listPrice as bigint,
            tx: e.transactionHash,
            block: e.blockNumber,
          });
        }
        for (const e of sold) {
          all.push({
            kind: "Purchased",
            bagId: e.args.bagId as bigint,
            price: e.args.price as bigint,
            buyer: e.args.buyer as string,
            tx: e.transactionHash,
            block: e.blockNumber,
          });
        }
        all.sort((a, b) => Number(b.block - a.block));
        setItems(all.slice(0, 50));
      } catch (err) {
        console.error("BuyBags fetch failed:", err);
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
    return <p className="text-sm text-muted-foreground py-6 text-center">No bag purchases yet.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((item, idx) => (
        <li key={`${item.tx}-${idx}`} className="py-3 flex items-start gap-3">
          <div
            className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${
              item.kind === "Purchased" ? "bg-primary" : "bg-muted-foreground"
            }`}
          />
          <div className="flex-1 min-w-0">
            <BagRow item={item} />
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

function BagRow({ item }: { item: BagEvent }) {
  if (item.kind === "Created") {
    return (
      <p className="text-sm">
        <span className="font-semibold">Bag #{String(item.bagId)} created</span> — bot bought tLINEA for{" "}
        <span className="font-mono tabular">{formatEth(item.paid)} ETH</span>, listed at{" "}
        <span className="font-mono tabular">{formatEth(item.listPrice)} ETH</span>
      </p>
    );
  }
  return (
    <p className="text-sm">
      <span className="font-semibold">Bag #{String(item.bagId)} purchased</span> for{" "}
      <span className="font-mono tabular">{formatEth(item.price)} ETH</span> by{" "}
      <a
        href={addressUrl(item.buyer)}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono hover:text-foreground"
      >
        {shortAddress(item.buyer)}
      </a>
    </p>
  );
}
