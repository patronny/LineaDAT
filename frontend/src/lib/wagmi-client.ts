"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { baseSepolia, linea } from "wagmi/chains";
import { http, fallback } from "viem";

/**
 * Client-only wagmi + RainbowKit configuration.
 * Imported only by `Providers` (which is itself a client component).
 * Server pages should import from `./wagmi` (server-safe constants only).
 */

// Placeholder projectId — used when env var is unset (e.g. local dev, preview deploy).
// Replace via NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID for production. WalletConnect mobile
// won't work without a real ID, but injected wallets (MetaMask, Rabby) will.
const wcProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  "00000000000000000000000000000000";

// Base Sepolia RPC fallback chain — primary endpoint flapped (ERR_CONNECTION_CLOSED)
// in May 2026, blanking the dashboard. viem `fallback` rotates on failure and on
// detected divergence; the first responsive endpoint wins. Override the whole list
// by setting NEXT_PUBLIC_RPC_URL.
const baseSepoliaRpcs = process.env.NEXT_PUBLIC_RPC_URL
  ? [http(process.env.NEXT_PUBLIC_RPC_URL)]
  : [
      http("https://sepolia.base.org"),
      http("https://base-sepolia-rpc.publicnode.com"),
      http("https://base-sepolia.public.blastapi.io"),
      http("https://base-sepolia.drpc.org"),
    ];

export const config = getDefaultConfig({
  appName: "LINEASTR",
  projectId: wcProjectId,
  chains: [baseSepolia, linea],
  transports: {
    [baseSepolia.id]: fallback(baseSepoliaRpcs, { rank: false, retryCount: 2 }),
    [linea.id]: http("https://rpc.linea.build"),
  },
  ssr: true,
});
