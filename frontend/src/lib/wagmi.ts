/**
 * Server-safe wagmi constants — pure data + helpers, no client-side functions.
 * The wagmi `config` object lives in `wagmi-client.ts` (client-only) so that server pages
 * importing ADDR / txUrl / etc don't accidentally pull `getDefaultConfig` into the server bundle.
 */

/**
 * Default chain for Phase 3 — Base Sepolia (84532). Phase 4 will switch to Linea (59144).
 */
export const DEFAULT_CHAIN_ID = parseInt(
  process.env.NEXT_PUBLIC_CHAIN_ID || "84532",
  10
);

function addressOr0(envVar: string | undefined): `0x${string}` {
  if (!envVar || !envVar.startsWith("0x") || envVar.length !== 42) {
    return "0x0000000000000000000000000000000000000000" as `0x${string}`;
  }
  return envVar as `0x${string}`;
}

export const ADDR = {
  tLINEA: addressOr0(process.env.NEXT_PUBLIC_TLINEA_ADDRESS),
  factory: addressOr0(process.env.NEXT_PUBLIC_FACTORY_ADDRESS),
  strategy: addressOr0(process.env.NEXT_PUBLIC_STRATEGY_ADDRESS),
  bot: addressOr0(process.env.NEXT_PUBLIC_BOT_ADDRESS),
} as const;

export const BLOCK_EXPLORER_URL =
  process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL || "https://sepolia.basescan.org";

export function txUrl(hash: string): string {
  return `${BLOCK_EXPLORER_URL}/tx/${hash}`;
}

export function addressUrl(address: string): string {
  return `${BLOCK_EXPLORER_URL}/address/${address}`;
}
