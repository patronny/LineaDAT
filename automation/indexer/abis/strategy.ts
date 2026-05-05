// Subset of LineaDATStrategy ABI — only the events Ponder indexes.
// Keep in sync with frontend/src/lib/abis/strategy.ts and contracts/src/LineaDATStrategy.sol.
export const strategyAbi = [
  {
    type: "event",
    name: "ERC20BoughtByProtocol",
    inputs: [
      { name: "bagId", type: "uint256", indexed: true },
      { name: "purchasePrice", type: "uint256", indexed: false },
      { name: "listPrice", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ERC20SoldByProtocol",
    inputs: [
      { name: "bagId", type: "uint256", indexed: true },
      { name: "price", type: "uint256", indexed: false },
      { name: "buyer", type: "address", indexed: false },
    ],
  },
] as const;
