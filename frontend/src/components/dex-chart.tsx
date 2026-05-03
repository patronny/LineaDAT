"use client";

import { Card } from "./ui/card";
import { ADDR } from "@/lib/wagmi";

/**
 * Dexscreener embedded chart — same provider as tokenstrategy.com uses on production tokens.
 *
 * Supported chains: Ethereum, Base, BNB, Polygon, Arbitrum, Optimism, Linea, etc.
 * Dexscreener does NOT index testnets (Base Sepolia, etc.). On testnet the iframe
 * renders DS's native "pair not found" page; we keep it embedded anyway because
 * the user asked for the exact reference layout, and the same component will go
 * live verbatim once we deploy to Linea mainnet in Phase 4 (the LINEASTR token
 * address will change but the embed slot stays the same).
 */
export function DexChart() {
  // chain slug: "linea" for mainnet, "basesepolia" attempted on testnet (DS will 404)
  const chainSlug = "basesepolia";
  const tokenOrPair = ADDR.strategy;
  const src = `https://dexscreener.com/${chainSlug}/${tokenOrPair}?embed=1&theme=dark&info=0&trades=0`;
  const externalLink = `https://dexscreener.com/${chainSlug}/${tokenOrPair}`;

  return (
    <Card className="overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-border flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm uppercase tracking-wider">$LINEASTR Chart</h3>
        <a
          href={externalLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground font-mono"
        >
          Open on Dexscreener ↗
        </a>
      </div>
      <div className="relative w-full" style={{ paddingBottom: "60%" }}>
        <iframe
          src={src}
          title="LINEASTR price chart by Dexscreener"
          className="absolute inset-0 w-full h-full border-0"
          loading="lazy"
        />
      </div>
      <div className="px-4 sm:px-5 py-2 border-t border-border text-[10px] text-muted-foreground text-center">
        Powered by Dexscreener · indexes mainnet pools only · Phase 3 testnet pool may not appear yet
      </div>
    </Card>
  );
}
