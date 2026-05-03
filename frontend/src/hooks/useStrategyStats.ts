"use client";

import { useReadContracts } from "wagmi";
import { strategyAbi } from "@/lib/abis/strategy";
import { erc20Abi } from "@/lib/abis/erc20";
import { ADDR } from "@/lib/wagmi";

/**
 * Aggregates the most-frequently-displayed strategy state into a single hook.
 * Uses wagmi's `useReadContracts` (multicall) to batch all reads in a single RPC call.
 * Auto-refetches every 12 seconds (1 block on Base).
 */
export function useStrategyStats() {
  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: [
      { address: ADDR.strategy, abi: strategyAbi, functionName: "name" },
      { address: ADDR.strategy, abi: strategyAbi, functionName: "symbol" },
      { address: ADDR.strategy, abi: strategyAbi, functionName: "totalSupply" },
      { address: ADDR.strategy, abi: strategyAbi, functionName: "bagSize" },
      { address: ADDR.strategy, abi: strategyAbi, functionName: "buyIncrement" },
      { address: ADDR.strategy, abi: strategyAbi, functionName: "priceMultiplier" },
      { address: ADDR.strategy, abi: strategyAbi, functionName: "currentFees" },
      { address: ADDR.strategy, abi: strategyAbi, functionName: "ethToTwap" },
      { address: ADDR.strategy, abi: strategyAbi, functionName: "twapIncrement" },
      { address: ADDR.strategy, abi: strategyAbi, functionName: "twapDelayInBlocks" },
      { address: ADDR.strategy, abi: strategyAbi, functionName: "lastBuyBlock" },
      { address: ADDR.strategy, abi: strategyAbi, functionName: "lastTwapBlock" },
      { address: ADDR.strategy, abi: strategyAbi, functionName: "lastBagId" },
      { address: ADDR.strategy, abi: strategyAbi, functionName: "availableFunds" },
      { address: ADDR.strategy, abi: strategyAbi, functionName: "getMaxPriceForBuy" },
      { address: ADDR.tLINEA, abi: erc20Abi, functionName: "balanceOf", args: [ADDR.strategy] },
      // Burn counter: LINEASTR balance held by 0x...dEaD (TWAP burns + future strategy buy-and-burn)
      { address: ADDR.strategy, abi: strategyAbi, functionName: "balanceOf", args: ["0x000000000000000000000000000000000000dEaD"] },
    ],
    query: {
      refetchInterval: 12_000,
      enabled: ADDR.strategy !== "0x0000000000000000000000000000000000000000",
    },
  });

  if (!data || data.some((d) => d.status === "failure")) {
    return {
      data: undefined,
      isLoading,
      error,
      refetch,
    };
  }

  const stats = {
    name: data[0].result as string,
    symbol: data[1].result as string,
    totalSupply: data[2].result as bigint,
    bagSize: data[3].result as bigint,
    buyIncrement: data[4].result as bigint,
    priceMultiplier: data[5].result as bigint,
    currentFees: data[6].result as bigint,
    ethToTwap: data[7].result as bigint,
    twapIncrement: data[8].result as bigint,
    twapDelayInBlocks: data[9].result as bigint,
    lastBuyBlock: data[10].result as bigint,
    lastTwapBlock: data[11].result as bigint,
    lastBagId: data[12].result as bigint,
    availableFunds: data[13].result as bigint,
    maxPriceForBuy: data[14].result as bigint,
    treasuryUnderlying: data[15].result as bigint,
    burned: data[16].result as bigint,
  };

  return { data: stats, isLoading, error, refetch };
}
