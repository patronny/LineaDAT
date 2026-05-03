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

/// PoolManager address on Base Sepolia.
export const POOL_MANAGER_ADDR = "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408" as `0x${string}`;

/// Live pool ID for ETH/LINEASTR (computed via keccak256(abi.encode(poolKey))).
/// Slot0 lives at: keccak256(abi.encode(poolId, 6)).
export const POOL_ID = "0xaac066f4e87b45065724b2d61094d042ebc15d01d087ee6c417af82a69169c35" as `0x${string}`;
export const POOL_SLOT0 = "0xf2de508f3c69be78ab51c2aa0cc8901cb6ae628f216f0e24ef5f574ab4c9ba7e" as `0x${string}`;
