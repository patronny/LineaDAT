import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { PublicClient } from "viem";

// Re-export of viem's getContractEvents return shape for one event — components
// import GetContractEventsReturnType<TAbi, TEventName> directly from viem when
// they need precise typing on chunked event reads.

/**
 * Fetch contract events across a wide block range by splitting into chunks.
 * Public RPCs cap eth_getLogs at 1k–10k blocks; we hit them in parallel and merge.
 * Failed chunks are silently dropped so a single transient error doesn't blank the table.
 *
 * Caller-provided generic R is the row shape returned by viem's typed getContractEvents
 * for the specific abi/eventName combination — pass it explicitly at the call site.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getEventsChunked<R = any>(
  client: PublicClient,
  params: Record<string, unknown>,
  options: { totalRange?: bigint; chunkSize?: bigint; fromBlock?: bigint } = {}
): Promise<R[]> {
  const totalRange = options.totalRange ?? 50_000n;
  const chunkSize = options.chunkSize ?? 9_000n;
  const latest = await client.getBlockNumber();
  // Lower bound: explicit fromBlock wins over rolling window.
  const start = options.fromBlock !== undefined
    ? (options.fromBlock < latest ? options.fromBlock : latest)
    : (latest > totalRange ? latest - totalRange : 0n);
  const ranges: Array<{ fromBlock: bigint; toBlock: bigint }> = [];
  for (let from = start; from <= latest; from += chunkSize) {
    const to = from + chunkSize - 1n > latest ? latest : from + chunkSize - 1n;
    ranges.push({ fromBlock: from, toBlock: to });
  }
  const settled = await Promise.allSettled(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ranges.map((r) => (client.getContractEvents as any)({ ...params, ...r }))
  );
  const out: R[] = [];
  for (const s of settled) {
    if (s.status === "fulfilled") out.push(...(s.value as R[]));
  }
  return out;
}

/**
 * Tailwind class merger — combines clsx for conditional logic with tailwind-merge for conflict resolution.
 * Standard shadcn/ui utility used by every component.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format an Ethereum address to a short form: 0x1234...abcd
 */
export function shortAddress(addr: string | undefined, chars = 4): string {
  if (!addr) return "0x...";
  if (addr.length < chars * 2 + 2) return addr;
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`;
}

/**
 * Format a wei value as ETH with N decimal places.
 */
export function formatEth(wei: bigint | undefined, decimals = 4): string {
  if (wei === undefined) return "—";
  const eth = Number(wei) / 1e18;
  return eth.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a tLINEA / LINEA value (also 18 decimals) — alias of formatEth with default 0 decimals.
 */
export function formatTokens(wei: bigint | undefined, decimals = 0): string {
  if (wei === undefined) return "—";
  const tokens = Number(wei) / 1e18;
  return tokens.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

/**
 * Convert a block number to an estimated time delta.
 * Base Sepolia ~2s/block; Linea ~3s/block.
 */
export function blocksToTime(blocks: number, secsPerBlock = 2): string {
  const secs = blocks * secsPerBlock;
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.round(secs / 60)}m`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h`;
  return `${Math.round(secs / 86400)}d`;
}

/**
 * Detect mobile viewport (used in client components for layout decisions).
 */
export function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768;
}

/**
 * Convert sqrtPriceX96 to LINEASTR-per-ETH ratio (Q64.96 → float).
 */
export function sqrtPriceX96ToRatio(sqrt: bigint): number {
  if (sqrt === 0n) return 0;
  const Q96 = 2 ** 96;
  const sqrtFloat = Number(sqrt) / Q96;
  return sqrtFloat * sqrtFloat;
}

/** ETH per 1 LINEASTR (inverse of pool price). */
export function lineastrPriceInEth(sqrt: bigint | undefined): number {
  if (!sqrt || sqrt === 0n) return 0;
  const r = sqrtPriceX96ToRatio(sqrt);
  return r > 0 ? 1 / r : 0;
}

/** Date formatter matching the reference layout: M/D/YYYY - HH:MM AM/PM */
export function formatTradeDate(unixSec: number): string {
  if (!unixSec) return "—";
  const d = new Date(unixSec * 1000);
  const date = d.toLocaleDateString("en-US", { year: "numeric", month: "numeric", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${date} - ${time}`;
}
