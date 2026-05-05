// Subset of LineaDATHook ABI — only the Trade event Ponder indexes.
// Keep in sync with frontend/src/lib/abis/swapper.ts (hookAbi) and contracts/src/LineaDATHook.sol.
export const hookAbi = [
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
