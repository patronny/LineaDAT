"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { ADDR, UNDERLYING_SYMBOL } from "@/lib/wagmi";
import { LineaDatSquareIcon } from "./icons/token-icons";

type Network = "all" | "linea" | "base" | "hyperevm";
type DatType = "all" | "classic" | "yield";
type Scope = "all" | "main" | "side";
type SortKey = "fdv" | "vol24h" | "burn" | "treasury" | "lp";

type DatEntry = {
  address: string;
  name: string;
  symbol: string;
  underlying: string;
  bagSize: string;
  network: Exclude<Network, "all">;
  type: Exclude<DatType, "all">;
  scope: Exclude<Scope, "all">;
  /**
   * Sort metrics, descending: fdv/vol24h/burn/treasury in USD terms, lp in the
   * pool's base asset (ETH for LINEADAT). Placeholder zeros until DAT #2 exists
   * and these get wired to live indexer/snapshot data - with a single DAT every
   * order is identical anyway.
   */
  metrics: Record<SortKey, number>;
};

const DATS: DatEntry[] = [
  {
    address: ADDR.strategy,
    name: "LineaDAT",
    symbol: "LINEADAT",
    underlying: UNDERLYING_SYMBOL,
    bagSize: "150 000",
    network: "linea",
    type: "classic",
    scope: "main",
    metrics: { fdv: 0, vol24h: 0, burn: 0, treasury: 0, lp: 0 },
  },
];

const SELECT_CLS =
  "bg-secondary text-secondary-foreground font-bold border border-border rounded px-2 py-1 font-mono hover:opacity-80 focus-visible:ring-2 focus-visible:ring-primary";

function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-muted-foreground uppercase tracking-wider">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className={SELECT_CLS}>
        {options.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * /dats content: full-bleed filter bar (network / type / scope / sort) right
 * under the site header, then the DAT card grid. Filters work today; sorting
 * becomes meaningful once a second DAT ships (see DatEntry.metrics).
 */
export function DatsExplorer() {
  const [network, setNetwork] = useState<Network>("all");
  const [type, setType] = useState<DatType>("all");
  const [scope, setScope] = useState<Scope>("all");
  const [sort, setSort] = useState<SortKey>("fdv");

  const visible = DATS.filter(
    (d) =>
      (network === "all" || d.network === network) &&
      (type === "all" || d.type === type) &&
      (scope === "all" || d.scope === scope),
  ).sort((a, b) => b.metrics[sort] - a.metrics[sort]);

  return (
    <>
      <div className="border-b border-border bg-card/30">
        <div className="container py-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <FilterSelect<Network>
            label="Network"
            value={network}
            onChange={setNetwork}
            options={[
              ["all", "All"],
              ["linea", "Linea"],
              ["base", "Base (coming soon)"],
              ["hyperevm", "HyperEVM (coming soon)"],
            ]}
          />
          <FilterSelect<DatType>
            label="Type"
            value={type}
            onChange={setType}
            options={[
              ["all", "All"],
              ["classic", "Classic DATs"],
              ["yield", "Yield DATs"],
            ]}
          />
          <FilterSelect<Scope>
            label="Scope"
            value={scope}
            onChange={setScope}
            options={[
              ["all", "All"],
              ["main", "Only main DATs"],
              ["side", "Only side DATs"],
            ]}
          />
          <FilterSelect<SortKey>
            label="Sort by"
            value={sort}
            onChange={setSort}
            options={[
              ["fdv", "FDV"],
              ["vol24h", "Volume 24h"],
              ["burn", "Burn"],
              ["treasury", "Treasury"],
              ["lp", "LP size"],
            ]}
          />
        </div>
      </div>

      <main className="container py-10 sm:py-16 min-h-[calc(100vh-3.5rem)]">
        <h1 className="text-3xl sm:text-4xl font-display font-bold mb-2">DATs</h1>
        <p className="text-muted-foreground mb-8">
          Every DAT besides the flagship $LINEADAT automatically pays 1% of its entire trading
          volume to buy back and burn $LINEADAT, on every single trade.
        </p>

        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center border border-dashed border-border rounded-md">
            {network === "base"
              ? "Base DATs are coming soon."
              : network === "hyperevm"
                ? "HyperEVM DATs are coming soon."
                : "No DATs match these filters."}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {visible.map((s) => (
              <Card key={s.address} className="p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <LineaDatSquareIcon className="w-12 h-12 flex-shrink-0" />
                  <h3 className="text-2xl font-display font-bold">
                    {s.name}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground mt-1">Backed by {s.underlying} · {s.bagSize} per bag</p>
                <p className="text-xs font-mono text-muted-foreground mt-3 break-all">{s.address}</p>
                <Button asChild className="mt-4 w-full">
                  <Link href={`/dats/${s.address}` as never}>View DAT</Link>
                </Button>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
