"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { Card } from "./ui/card";
import { hookAbi } from "@/lib/abis/swapper";
import { ADDR } from "@/lib/wagmi";
import { sqrtPriceX96ToRatio } from "@/lib/utils";

type Point = { ts: number; price: number };

/**
 * Live price chart — derives ETH-per-LINEASTR from each hook Trade event's sqrtPriceX96.
 * Renders an SVG sparkline with grid + y-axis labels. Auto-refreshes every 30s.
 */
export function PriceChart() {
  const client = usePublicClient();
  const [points, setPoints] = useState<Point[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (
      !client ||
      ADDR.hook === "0x0000000000000000000000000000000000000000"
    ) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    async function fetch() {
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
        const sorted = [...events].sort((a, b) => Number(a.blockNumber - b.blockNumber));
        const enriched: Point[] = await Promise.all(
          sorted.map(async (e) => {
            const block = await client!.getBlock({ blockHash: e.blockHash });
            const sqrt = BigInt(e.args.sqrtPriceX96 as bigint | number);
            const lineastrPerEth = sqrtPriceX96ToRatio(sqrt);
            const ethPerLineastr = lineastrPerEth > 0 ? 1 / lineastrPerEth : 0;
            return { ts: Number(block.timestamp), price: ethPerLineastr };
          })
        );
        if (!cancelled) setPoints(enriched);
      } catch (err) {
        console.error("PriceChart fetch failed:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetch();
    const id = setInterval(fetch, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [client]);

  return (
    <Card>
      <div className="px-4 sm:px-5 py-3 border-b border-border flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm uppercase tracking-wider">$LINEASTR Chart</h3>
        <span className="text-xs text-muted-foreground font-mono">
          {points.length} swaps · last 3h
        </span>
      </div>

      <div className="p-4 sm:p-5 min-h-[280px]">
        {isLoading ? (
          <div className="h-[260px] rounded-md bg-muted animate-pulse" />
        ) : points.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">
            No swap data yet. Chart populates after the first swap event in the rolling window.
          </p>
        ) : (
          <Sparkline points={points} />
        )}
      </div>
    </Card>
  );
}

function Sparkline({ points }: { points: Point[] }) {
  const width = 720;
  const height = 240;
  const pad = { top: 12, right: 56, bottom: 24, left: 12 };

  const xs = points.map((p) => p.ts);
  const ys = points.map((p) => p.price);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const yRange = yMax - yMin || yMax * 0.001 || 1;
  const xRange = xMax - xMin || 1;

  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;

  const px = (t: number) => pad.left + ((t - xMin) / xRange) * W;
  const py = (v: number) => pad.top + H - ((v - yMin) / yRange) * H;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${px(p.ts).toFixed(2)} ${py(p.price).toFixed(2)}`)
    .join(" ");

  // Area fill underneath line
  const area = `${path} L ${px(xMax).toFixed(2)} ${pad.top + H} L ${px(xMin).toFixed(2)} ${pad.top + H} Z`;

  const fmtPrice = (v: number) =>
    v < 1e-9 ? v.toExponential(1) : v.toFixed(10).replace(/\.?0+$/, "");

  // 4 horizontal grid lines
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => yMin + t * yRange);

  // First/last timestamps
  const fmtTime = (ts: number) =>
    new Date(ts * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="none">
      {/* horizontal grid + y-axis labels */}
      {gridLines.map((g, i) => (
        <g key={i}>
          <line
            x1={pad.left}
            x2={pad.left + W}
            y1={py(g)}
            y2={py(g)}
            stroke="currentColor"
            className="text-border"
            strokeWidth="0.5"
            strokeDasharray="2 4"
          />
          <text
            x={pad.left + W + 4}
            y={py(g) + 3}
            className="fill-muted-foreground text-[10px] font-mono"
          >
            {fmtPrice(g)}
          </text>
        </g>
      ))}

      {/* area + line */}
      <path d={area} className="fill-primary/15" />
      <path d={path} className="stroke-primary" strokeWidth="1.8" fill="none" />

      {/* dots on each point */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={px(p.ts)}
          cy={py(p.price)}
          r="2"
          className="fill-primary"
        />
      ))}

      {/* x-axis: first / last timestamp labels */}
      <text x={pad.left} y={height - 6} className="fill-muted-foreground text-[10px] font-mono">
        {fmtTime(xMin)}
      </text>
      <text
        x={pad.left + W}
        y={height - 6}
        textAnchor="end"
        className="fill-muted-foreground text-[10px] font-mono"
      >
        {fmtTime(xMax)}
      </text>
    </svg>
  );
}
