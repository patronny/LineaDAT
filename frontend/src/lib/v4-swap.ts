/**
 * Uniswap v4 swap encoding for the Universal Router (V4_SWAP command), plus the Universal Router
 * and Permit2 ABIs the swap card needs.
 *
 * This replaces the custom LineaDATTestSwapper: $LINEADAT is non-transferable, but a swap through
 * the standard Universal Router works because the hook grants a transient transfer allowance in
 * afterSwap (covers PoolManager<->user moves) - no distributor whitelist required. The exact
 * command/action/param encoding below was validated on a Linea-mainnet fork against the real
 * Universal Router (0x8B844f) for both buy and sell (see contracts/test/ForkUniversalRouter.t.sol).
 *
 * Buy  (ETH -> LINEADAT): execute{value}( [V4_SWAP], [encode(actions, params)] ), no approval.
 * Sell (LINEADAT -> ETH): needs Permit2 (token->Permit2 approve, Permit2->UR allowance), then execute.
 */
import { encodeAbiParameters, encodePacked, type Hex } from "viem";
import { POOL_KEY } from "./wagmi";

// Universal Router command
const V4_SWAP = 0x10;
// v4 Actions
const SWAP_EXACT_IN_SINGLE = 0x06;
const SETTLE_ALL = 0x0c;
const TAKE_ALL = 0x0f;

const poolKeyComponents = [
  { name: "currency0", type: "address" },
  { name: "currency1", type: "address" },
  { name: "fee", type: "uint24" },
  { name: "tickSpacing", type: "int24" },
  { name: "hooks", type: "address" },
] as const;

const exactInputSingleParam = {
  type: "tuple",
  components: [
    { name: "poolKey", type: "tuple", components: poolKeyComponents },
    { name: "zeroForOne", type: "bool" },
    { name: "amountIn", type: "uint128" },
    { name: "amountOutMinimum", type: "uint128" },
    { name: "hookData", type: "bytes" },
  ],
} as const;

const currencyAmountParam = [
  { name: "currency", type: "address" },
  { name: "amount", type: "uint256" },
] as const;

function poolKeyStruct() {
  return {
    currency0: POOL_KEY.currency0,
    currency1: POOL_KEY.currency1,
    fee: POOL_KEY.fee,
    tickSpacing: POOL_KEY.tickSpacing,
    hooks: POOL_KEY.hooks,
  };
}

/**
 * Encode a single-pool exact-input V4_SWAP for the Universal Router.
 * @param zeroForOne true = ETH(0)->LINEADAT(1) buy; false = LINEADAT(1)->ETH(0) sell
 * @param amountIn   exact input amount (wei)
 * @param amountOutMinimum slippage floor on the output (wei); revert if not met
 */
export function encodeV4Swap(
  zeroForOne: boolean,
  amountIn: bigint,
  amountOutMinimum: bigint
): { commands: Hex; inputs: readonly Hex[] } {
  const inputCurrency = zeroForOne ? POOL_KEY.currency0 : POOL_KEY.currency1;
  const outputCurrency = zeroForOne ? POOL_KEY.currency1 : POOL_KEY.currency0;

  const actions = encodePacked(
    ["uint8", "uint8", "uint8"],
    [SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL]
  );

  const swapParam = encodeAbiParameters(
    [exactInputSingleParam],
    [
      {
        poolKey: poolKeyStruct(),
        zeroForOne,
        amountIn,
        amountOutMinimum,
        hookData: "0x",
      },
    ]
  );
  const settleParam = encodeAbiParameters(currencyAmountParam, [inputCurrency, amountIn]);
  const takeParam = encodeAbiParameters(currencyAmountParam, [outputCurrency, amountOutMinimum]);

  const input = encodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes[]" }],
    [actions, [swapParam, settleParam, takeParam]]
  );

  return {
    commands: encodePacked(["uint8"], [V4_SWAP]),
    inputs: [input],
  };
}

export const universalRouterAbi = [
  {
    type: "function",
    name: "execute",
    stateMutability: "payable",
    inputs: [
      { name: "commands", type: "bytes" },
      { name: "inputs", type: "bytes[]" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export const permit2Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
  },
] as const;

export const MAX_UINT256 = (1n << 256n) - 1n;
export const MAX_UINT160 = (1n << 160n) - 1n;
// uint48 max as a JS number (viem types uint48 params as `number`); 2^48-1 is within Number.MAX_SAFE_INTEGER.
export const MAX_UINT48 = Number((1n << 48n) - 1n);

export function swapDeadline(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + 1800); // 30 min
}
