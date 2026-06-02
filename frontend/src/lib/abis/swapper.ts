/**
 * LineastrTestSwapper ABI - Phase 3.5 testnet helper for Buy/Sell LINEASTR via PoolManager.unlock.
 * Production frontend will use UniversalRouter with V4_SWAP commands instead.
 */
export const hookAbi = [
  {
    type: "function",
    name: "calculateFee",
    stateMutability: "view",
    inputs: [
      { name: "collection", type: "address" },
      { name: "isBuying", type: "bool" },
    ],
    outputs: [{ name: "", type: "uint128" }],
  },
  {
    type: "function",
    name: "deploymentTime",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "Trade",
    inputs: [
      { name: "strategy", type: "address", indexed: true },
      { name: "sqrtPriceX96", type: "uint160", indexed: false },
      { name: "ethAmount", type: "int128", indexed: false },
      { name: "tokenAmount", type: "int128", indexed: false },
    ],
  },
] as const;

export const swapperAbi = [
  {
    type: "function",
    name: "buyExactInput",
    stateMutability: "payable",
    inputs: [
      {
        name: "key",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
      { name: "recipient", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "sellExactInput",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "key",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
      { name: "amountIn", type: "uint256" },
      { name: "recipient", type: "address" },
    ],
    outputs: [],
  },
] as const;
