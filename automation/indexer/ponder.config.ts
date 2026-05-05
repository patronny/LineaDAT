import { createConfig } from "ponder";
import { strategyAbi } from "./abis/strategy";
import { hookAbi } from "./abis/hook";

// Defaults reflect the LIVE Phase 3 Base Sepolia deployment (2026-05-03).
// Override on Fly via `fly secrets set --app lineastr-indexer STRATEGY_ADDRESS=…`
// after any redeploy. Phase 4 mainnet should set both via secrets, not edit here.
const STRATEGY = (process.env.STRATEGY_ADDRESS ??
  "0x6ddbC0bF9e8Bb2f8Bd9Dfd27876197340dDc7EB2") as `0x${string}`;
const HOOK = (process.env.HOOK_ADDRESS ??
  "0x61116044DC8eB623A618021cEDB14836D6512444") as `0x${string}`;

// Block at or before strategy proxy deployment. Indexer scans from here forward.
// Override via START_BLOCK env on Fly. Conservative testnet default: 0 (full scan,
// fine on Sepolia, do not deploy this default to mainnet).
const START_BLOCK = process.env.START_BLOCK
  ? Number(process.env.START_BLOCK)
  : 0;

// Phase 3: Base Sepolia (84532). Phase 4 will switch chain id and addresses.
export default createConfig({
  chains: {
    baseSepolia: {
      id: 84532,
      rpc:
        process.env.PONDER_RPC_URL_84532 ??
        "https://base-sepolia-rpc.publicnode.com",
    },
  },
  contracts: {
    LineastrStrategy: {
      abi: strategyAbi,
      chain: "baseSepolia",
      address: STRATEGY,
      startBlock: START_BLOCK,
    },
    LineastrHook: {
      abi: hookAbi,
      chain: "baseSepolia",
      address: HOOK,
      startBlock: START_BLOCK,
    },
  },
  database: {
    kind: "pglite",
    directory: process.env.PONDER_DATABASE_DIRECTORY ?? "./.ponder/pglite",
  },
});
