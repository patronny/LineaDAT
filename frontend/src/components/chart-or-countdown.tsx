"use client";

import { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import { ADDR } from "@/lib/wagmi";
import { DexChart } from "./dex-chart";
import { LaunchCountdown } from "./launch-countdown";

const hookAbi = [
  {
    type: "function",
    name: "deploymentTime",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

/**
 * Pre-launch: render LaunchCountdown.
 * Post-launch: render DexChart.
 *
 * Decision is driven by hook.deploymentTime[strategy] vs current time.
 */
export function ChartOrCountdown() {
  const { data } = useReadContract({
    address: ADDR.hook,
    abi: hookAbi,
    functionName: "deploymentTime",
    args: [ADDR.strategy],
    query: { refetchInterval: 30_000 },
  });

  const launchTs = data ? Number(data) : 0;
  const [now, setNow] = useState<number>(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  if (!launchTs) return <DexChart />;
  if (now < launchTs) return <LaunchCountdown />;
  return <DexChart />;
}
