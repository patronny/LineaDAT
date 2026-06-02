"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPublicClient, http, formatEther } from "viem";
import { linea, baseSepolia } from "viem/chains";
import { ADDR, DEFAULT_CHAIN_ID, UNDERLYING_SYMBOL } from "@/lib/wagmi";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

/**
 * Live ops dashboard - one place to watch every module during launch / critical moments.
 *   - Keeper: liveness + last tick + balances + last action (from lineadat-keeper /status)
 *   - Strategy (on-chain): fees pot, availableFunds, ethToTwap, bags, burned, launch gate
 *   - Indexer: healthz + bag/swap row counts (Ponder GraphQL)
 *   - Network: chain head block
 * Auto-refreshes every 5s. Read-only; all data is public on-chain + service liveness.
 */

const KEEPER_STATUS_URL =
  process.env.NEXT_PUBLIC_KEEPER_STATUS_URL || "https://lineadat-keeper.fly.dev/status";
const INDEXER_URL = process.env.NEXT_PUBLIC_INDEXER_URL || "";
const RPC = process.env.NEXT_PUBLIC_LINEA_RPC_URL || "https://rpc.linea.build";
const REFRESH_MS = 5000;
const MAX_SUPPLY = 1_000_000_000n * 10n ** 18n;
// Buy-and-burn sends tokens to the dead address (it does NOT reduce totalSupply),
// so "burned" = balanceOf(DEAD), not MAX_SUPPLY - totalSupply.
const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD" as const;

const chain = DEFAULT_CHAIN_ID === 59144 ? linea : baseSepolia;
const client = createPublicClient({ chain, transport: http(RPC) });

const strategyAbi = [
  { type: "function", name: "currentFees", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "availableFunds", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "ethToTwap", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "lastBagId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "bagSize", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const hookAbi = [
  { type: "function", name: "deploymentTime", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

type Health = "ok" | "warn" | "fail" | "idle";

interface KeeperStatus {
  alive?: boolean;
  updatedAt?: string;
  tick?: string;
  availableFundsEth?: string;
  currentFeesEth?: string;
  ethToTwapEth?: string;
  lastBagId?: string;
  bagSizeEth?: string;
  bagMarketCostEth?: string | null;
  lineaPriceEth?: string | null;
  buyEdgeEth?: string | null;
  keeperEth?: string;
  keeperLinea?: string;
  lastAction?: string;
  lastError?: string | null;
  enabled?: { buy: boolean; sell: boolean; twap: boolean };
  pollIntervalMs?: number;
}

interface ChainState {
  currentFees: bigint;
  availableFunds: bigint;
  ethToTwap: bigint;
  lastBagId: bigint;
  bagSize: bigint;
  totalSupply: bigint;
  burned: bigint;
  launchTs: number;
  block: bigint;
}

function fmt(wei: bigint, dp = 6): string {
  const n = Number(formatEther(wei));
  return n.toLocaleString("en-US", { maximumFractionDigits: dp });
}

// Keeper /status sends ETH amounts as pre-formatted strings; render with a fixed dp.
function fmtStr(s: string | null | undefined, dp: number): string {
  if (s == null) return "-";
  const n = Number(s);
  return isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: dp }) : "-";
}

function Dot({ h }: { h: Health }) {
  const color =
    h === "ok" ? "bg-success" : h === "warn" ? "bg-yellow-400" : h === "fail" ? "bg-destructive" : "bg-muted-foreground";
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${color} ${h === "ok" ? "animate-pulse" : ""}`} />;
}

function Card({ title, h, children }: { title: string; h: Health; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Dot h={h} />
        <h3 className="text-sm font-semibold uppercase tracking-wider">{title}</h3>
      </div>
      <dl className="space-y-1.5 text-sm font-mono">{children}</dl>
    </div>
  );
}

function Row({ k, v, accent }: { k: string; v: ReactNode; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={`tabular text-right ${accent ? "text-primary font-semibold" : "text-foreground"}`}>{v}</dd>
    </div>
  );
}

export default function StatusPage() {
  const [keeper, setKeeper] = useState<KeeperStatus | null>(null);
  const [keeperHealth, setKeeperHealth] = useState<Health>("idle");
  const [cs, setCs] = useState<ChainState | null>(null);
  const [chainHealth, setChainHealth] = useState<Health>("idle");
  const [idx, setIdx] = useState<{ bags: number; swaps: number; healthz: boolean } | null>(null);
  const [idxHealth, setIdxHealth] = useState<Health>("idle");
  const [now, setNow] = useState<number>(() => Math.floor(Date.now() / 1000));
  const [lastRefresh, setLastRefresh] = useState<number>(0);

  const refresh = useCallback(async () => {
    // Keeper /status
    try {
      const r = await fetch(KEEPER_STATUS_URL, { cache: "no-store" });
      const j: KeeperStatus = await r.json();
      setKeeper(j);
      // Stranded LINEA on the ETH-only keeper means a round half-completed (a swap landed
      // but buyTokens/sellTokens reverted). Flag only when a near-full bag is stuck - the
      // exact-input acquisition leaves a small LINEA dust each buy, which is benign.
      const bagSz = j.bagSizeEth ? Number(j.bagSizeEth) : 0;
      const stranded = bagSz > 0 && j.keeperLinea ? Number(j.keeperLinea) >= bagSz * 0.9 : false;
      setKeeperHealth(j.lastError ? "warn" : !j.alive ? "fail" : stranded ? "warn" : "ok");
    } catch {
      setKeeper(null);
      setKeeperHealth("fail");
    }

    // On-chain strategy + hook gate + head block
    try {
      const [currentFees, availableFunds, ethToTwap, lastBagId, bagSize, totalSupply, burned, launchRaw, block] =
        await Promise.all([
          client.readContract({ address: ADDR.strategy, abi: strategyAbi, functionName: "currentFees" }),
          client.readContract({ address: ADDR.strategy, abi: strategyAbi, functionName: "availableFunds" }),
          client.readContract({ address: ADDR.strategy, abi: strategyAbi, functionName: "ethToTwap" }),
          client.readContract({ address: ADDR.strategy, abi: strategyAbi, functionName: "lastBagId" }),
          client.readContract({ address: ADDR.strategy, abi: strategyAbi, functionName: "bagSize" }),
          client.readContract({ address: ADDR.strategy, abi: strategyAbi, functionName: "totalSupply" }),
          client.readContract({ address: ADDR.strategy, abi: strategyAbi, functionName: "balanceOf", args: [DEAD_ADDRESS] }),
          client.readContract({ address: ADDR.hook, abi: hookAbi, functionName: "deploymentTime", args: [ADDR.strategy] }),
          client.getBlockNumber(),
        ]);
      setCs({
        currentFees: currentFees as bigint,
        availableFunds: availableFunds as bigint,
        ethToTwap: ethToTwap as bigint,
        lastBagId: lastBagId as bigint,
        bagSize: bagSize as bigint,
        totalSupply: totalSupply as bigint,
        burned: burned as bigint,
        launchTs: Number(launchRaw as bigint),
        block: block as bigint,
      });
      setChainHealth("ok");
    } catch {
      setChainHealth("fail");
    }

    // Indexer healthz + GraphQL counts
    if (INDEXER_URL) {
      try {
        const healthzUrl = INDEXER_URL.replace(/\/graphql\/?$/, "/healthz");
        const [hz, gq] = await Promise.all([
          fetch(healthzUrl, { cache: "no-store" }).then((r) => r.ok).catch(() => false),
          fetch(INDEXER_URL, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ query: "{ bags { totalCount } swaps { totalCount } }" }),
            cache: "no-store",
          }).then((r) => r.json()),
        ]);
        const bags = gq?.data?.bags?.totalCount ?? 0;
        const swaps = gq?.data?.swaps?.totalCount ?? 0;
        setIdx({ bags, swaps, healthz: hz });
        setIdxHealth(hz ? "ok" : "warn");
      } catch {
        setIdx(null);
        setIdxHealth("fail");
      }
    } else {
      setIdxHealth("idle");
    }

    setLastRefresh(Math.floor(Date.now() / 1000));
  }, []);

  useEffect(() => {
    refresh();
    const r = setInterval(refresh, REFRESH_MS);
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => {
      clearInterval(r);
      clearInterval(t);
    };
  }, [refresh]);

  // Derived
  const keeperAgeSec = keeper?.updatedAt ? Math.max(0, now - Math.floor(Date.parse(keeper.updatedAt) / 1000)) : null;
  const keeperBagSz = keeper?.bagSizeEth ? Number(keeper.bagSizeEth) : 0;
  const isStranded =
    keeperBagSz > 0 && keeper?.keeperLinea ? Number(keeper.keeperLinea) >= keeperBagSz * 0.9 : false;
  // All-in BUY margin per bag. Prefer the keeper's own buyEdgeEth (availableFunds minus
  // bagCost*(1+slippage) minus gas) - it mirrors tryBuy's profit gate exactly, so >= 0
  // is the true go/no-go: the keeper fires a buy. Fall back to the rough market-only
  // delta (no slippage/gas) for older keeper builds that don't report buyEdgeEth yet.
  const buyEdge =
    keeper?.buyEdgeEth != null
      ? Number(keeper.buyEdgeEth)
      : keeper?.availableFundsEth != null && keeper?.bagMarketCostEth != null
        ? Number(keeper.availableFundsEth) - Number(keeper.bagMarketCostEth)
        : null;
  // Burned share = balanceOf(DEAD) / MAX_SUPPLY (supply is constant; burns accrue at DEAD).
  const burnedPct = cs ? Number((cs.burned * 1_000_000n) / MAX_SUPPLY) / 10_000 : 0;
  const gateOpen = cs ? cs.launchTs !== 0 && now >= cs.launchTs : false;
  const gateRemaining = cs && cs.launchTs > now ? cs.launchTs - now : 0;
  const d = Math.floor(gateRemaining / 86400);
  const h = Math.floor((gateRemaining % 86400) / 3600);
  const m = Math.floor((gateRemaining % 3600) / 60);
  const sec = gateRemaining % 60;

  return (
    <>
      <Header />
      <main className="container py-6 sm:py-10">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold">Ops Status</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Live health of every module · refreshes every {REFRESH_MS / 1000}s
            </p>
          </div>
          <div className="text-right text-xs font-mono text-muted-foreground">
            <div>chain {chain.id}</div>
            {lastRefresh > 0 ? <div>updated {Math.max(0, now - lastRefresh)}s ago</div> : <div>loading…</div>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* KEEPER */}
          <Card title="Keeper (bot)" h={keeperHealth}>
            {keeper ? (
              <>
                <Row k="status" v={keeper.lastError ? "error" : keeper.alive ? "alive" : "stale"} accent={keeper.alive && !keeper.lastError} />
                <Row k="last tick" v={keeperAgeSec != null ? `${keeperAgeSec}s ago (#${keeper.tick})` : "-"} />
                <Row k="poll interval" v={keeper.pollIntervalMs != null ? `${keeper.pollIntervalMs / 1000}s` : "-"} />
                <Row k="last action" v={keeper.lastAction ?? "-"} accent={!!keeper.lastAction && keeper.lastAction !== "none"} />
                <Row k={`${UNDERLYING_SYMBOL} price`} v={`${fmtStr(keeper.lineaPriceEth, 9)} ETH`} />
                <Row k="bag mkt cost" v={`${fmtStr(keeper.bagMarketCostEth, 6)} ETH`} />
                <Row
                  k="buy edge"
                  v={
                    buyEdge == null
                      ? "-"
                      : `${buyEdge >= 0 ? "+" : ""}${buyEdge.toLocaleString("en-US", { maximumFractionDigits: 6 })} ETH`
                  }
                  accent={buyEdge != null && buyEdge >= 0}
                />
                <Row k="keeper ETH" v={`${fmtStr(keeper.keeperEth, 6)} ETH`} />
                <Row
                  k={`keeper ${UNDERLYING_SYMBOL}`}
                  v={
                    <span className={isStranded ? "text-yellow-400" : "text-muted-foreground"}>
                      {fmtStr(keeper.keeperLinea, 4)}
                      {isStranded ? " stranded" : ""}
                    </span>
                  }
                />
                <Row
                  k="modes"
                  v={
                    keeper.enabled ? (
                      <span className="inline-flex gap-2.5">
                        {(["buy", "sell", "twap"] as const).map((mode) => {
                          const on = keeper.enabled![mode];
                          return (
                            <span key={mode} className="text-muted-foreground">
                              {mode}:
                              <span
                                className={
                                  on
                                    ? "font-semibold text-success [text-shadow:0_0_8px_hsl(var(--success)/0.85)]"
                                    : "font-semibold text-primary [text-shadow:0_0_8px_hsl(var(--primary)/0.85)]"
                                }
                              >
                                {on ? "on" : "off"}
                              </span>
                            </span>
                          );
                        })}
                      </span>
                    ) : (
                      "-"
                    )
                  }
                />
                {keeper.lastError ? <Row k="error" v={<span className="text-destructive">{keeper.lastError.slice(0, 40)}</span>} /> : null}
              </>
            ) : (
              <Row k="status" v={<span className="text-destructive">unreachable</span>} />
            )}
          </Card>

          {/* DAT ON-CHAIN */}
          <Card title="DAT (on-chain)" h={chainHealth}>
            {cs ? (
              <>
                <Row k="trading gate" v={gateOpen ? <span className="text-success">LIVE</span> : `opens in ${d}d ${h}h ${m}m ${sec}s`} accent={gateOpen} />
                <Row k="currentFees" v={`${fmt(cs.currentFees)} ETH`} />
                <Row k="availableFunds" v={`${fmt(cs.availableFunds)} ETH`} accent={cs.availableFunds > 0n} />
                <Row k="ethToTwap" v={`${fmt(cs.ethToTwap)} ETH`} />
                <Row k="bags bought" v={cs.lastBagId.toString()} />
                <Row k="bag size" v={`${fmt(cs.bagSize, 0)} ${UNDERLYING_SYMBOL}`} />
                <Row k="burned" v={`${burnedPct.toFixed(4)}%`} accent={burnedPct > 0} />
              </>
            ) : (
              <Row k="status" v={<span className="text-destructive">RPC unreachable</span>} />
            )}
          </Card>

          {/* INDEXER */}
          <Card title="Indexer (Ponder)" h={idxHealth}>
            {INDEXER_URL ? (
              idx ? (
                <>
                  <Row k="healthz" v={idx.healthz ? <span className="text-success">200 OK</span> : <span className="text-destructive">down</span>} accent={idx.healthz} />
                  <Row k="bag rows" v={idx.bags.toString()} />
                  <Row k="swap rows" v={idx.swaps.toString()} />
                </>
              ) : (
                <Row k="status" v={<span className="text-destructive">unreachable</span>} />
              )
            ) : (
              <Row k="status" v="not configured" />
            )}
          </Card>

          {/* NETWORK */}
          <Card title="Network" h={chainHealth}>
            <Row k="chain" v={`${chain.name} (${chain.id})`} />
            <Row k="head block" v={cs ? cs.block.toString() : "-"} />
            <Row k="RPC" v={RPC.includes("infura") ? "Infura (paid)" : "public"} />
            <Row k="frontend" v={<span className="text-success">up</span>} accent />
          </Card>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          All values are public on-chain data + service liveness. This page makes no transactions.
        </p>
      </main>
      <Footer />
    </>
  );
}
