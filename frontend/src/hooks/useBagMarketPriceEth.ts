"use client";

import { useReadContract } from "wagmi";
import { DEFAULT_CHAIN_ID } from "@/lib/wagmi";

/**
 * Returns the ETH cost of one full bag of the underlying asset at the most liquid
 * LINEA/ETH market - the denominator for the "X% to next bag" progress bar.
 *
 * Mainnet (Linea, 59144): live read of the Etherex CL QuoterV2 - the WETH needed to
 * acquire `bagSize` LINEA, i.e. exactly what the keeper pays to source a bag. The bar
 * then reaches 100% precisely when accrued fees can afford a fresh bag at the live price.
 *
 * Base Sepolia testnet: tLINEA is a faucet mock with no real market, so fall back to the
 * keeper's 0.02 ETH buy threshold (the prod testnet site is unaffected by this change).
 */
const PHASE3_BAG_MARKET_PRICE_WEI = 20_000_000_000_000_000n; // 0.02 ETH

const ETHEREX_QUOTER = "0xE660C95E17884b6C81B01445EFC24556f8ABa037" as const;
const LINEA_WETH = "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f" as const;
const CANONICAL_LINEA = "0x1789e0043623282D5DCc7F213d703C6D8BAfBB04" as const;
const ETHEREX_TICK_SPACING = 50;

// Etherex CL QuoterV2 quoteExactOutputSingle. Declared `view` so wagmi reads it via
// eth_call; the on-chain function is non-view (revert-to-return) but eth_call resolves it.
const quoterAbi = [
  {
    type: "function",
    name: "quoteExactOutputSingle",
    stateMutability: "view",
    inputs: [
      {
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "tickSpacing", type: "int24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountIn", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;

export function useBagMarketPriceEth(bagSize: bigint): bigint {
  const isMainnet = DEFAULT_CHAIN_ID === 59144;
  const { data } = useReadContract({
    address: ETHEREX_QUOTER,
    abi: quoterAbi,
    functionName: "quoteExactOutputSingle",
    args: [
      {
        tokenIn: LINEA_WETH,
        tokenOut: CANONICAL_LINEA,
        amount: bagSize,
        tickSpacing: ETHEREX_TICK_SPACING,
        sqrtPriceLimitX96: 0n,
      },
    ],
    query: { enabled: isMainnet && bagSize > 0n, refetchInterval: 30_000 },
  });

  if (!isMainnet) return PHASE3_BAG_MARKET_PRICE_WEI;
  // `data` is the tuple [amountIn, ...]; 0n until the first read resolves (bar shows 0%).
  return Array.isArray(data) && (data[0] as bigint) > 0n ? (data[0] as bigint) : 0n;
}
