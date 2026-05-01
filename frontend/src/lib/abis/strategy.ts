/**
 * LINEASTRStrategy ABI — minimal subset needed by the frontend.
 * Matches contracts/src/LINEASTRStrategy.sol + BaseStrategy.sol.
 */
export const strategyAbi = [
  // Reads
  { type: "function", name: "VERSION", stateMutability: "pure", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "token", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "bagSize", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "buyIncrement", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "priceMultiplier", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "currentFees", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "ethToTwap", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "twapIncrement", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "twapDelayInBlocks", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "lastBuyBlock", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "lastTwapBlock", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "lastBagId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "onSale", stateMutability: "view", inputs: [{ name: "bagId", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "availableFunds", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getMaxPriceForBuy", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "list", stateMutability: "view", inputs: [{ type: "uint256" }, { type: "uint256" }], outputs: [{ type: "uint256[]" }] },

  // Writes (P2P bag mechanics)
  { type: "function", name: "buyTokens", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "sellTokens", stateMutability: "payable", inputs: [{ name: "bagId", type: "uint256" }], outputs: [] },
  { type: "function", name: "processTokenTwap", stateMutability: "nonpayable", inputs: [], outputs: [] },

  // Events
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
  {
    type: "event",
    name: "BoughtAndBurned",
    inputs: [
      { name: "amount0", type: "int256", indexed: false },
      { name: "amount1", type: "int256", indexed: false },
    ],
  },
] as const;
