import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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
