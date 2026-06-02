import { encodeAbiParameters, keccak256 } from "viem";
import { POOL_KEY, DEFAULT_CHAIN_ID } from "../wagmi";

/// Minimal v4 PoolManager ABI for reading slot0 via extsload.
export const poolManagerAbi = [
  {
    type: "function",
    name: "extsload",
    stateMutability: "view",
    inputs: [{ name: "slot", type: "bytes32" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

/// PoolManager address - stage-aware. Linea mainnet (59144) and Base Sepolia run the
/// same v4 PoolManager bytecode (so the slot-6 _pools layout below holds for both), but
/// at different addresses. Hardcoding the Base Sepolia address made slot0 reads on Linea
/// hit a non-pool address -> sqrtPriceX96=0 -> price/MC/FDV rendered as "-".
export const POOL_MANAGER_ADDR = (DEFAULT_CHAIN_ID === 59144
  ? "0x248083Fb965359d82b06C1F5322480Dcfc1AD857"
  : "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408") as `0x${string}`;

/// Pool ID = keccak256(abi.encode(PoolKey)). Computed at runtime so a contract
/// redeploy (which changes ADDR.strategy / ADDR.hook) auto-updates the pool ID
/// without manual sync. Previously this was hardcoded to a stale (zombie) pool's
/// ID, which made the live slot0 read return a different price than the indexer
/// reported, breaking the 24h change widget.
export const POOL_ID: `0x${string}` = keccak256(
  encodeAbiParameters(
    [
      { type: "address" },
      { type: "address" },
      { type: "uint24" },
      { type: "int24" },
      { type: "address" },
    ],
    [
      POOL_KEY.currency0,
      POOL_KEY.currency1,
      POOL_KEY.fee,
      POOL_KEY.tickSpacing,
      POOL_KEY.hooks,
    ]
  )
);

/// slot0 storage key: keccak256(abi.encode(poolId, 6)). Slot 6 is the _pools
/// mapping in PoolManager; slot0 is the first field of the Pool struct.
export const POOL_SLOT0: `0x${string}` = keccak256(
  encodeAbiParameters(
    [{ type: "bytes32" }, { type: "uint256" }],
    [POOL_ID, 6n]
  )
);
