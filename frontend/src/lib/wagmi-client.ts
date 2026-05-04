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

// Base Sepolia RPC fallback chain. Only browser-callable endpoints — drpc.org
// and blastapi.io don't return Access-Control-Allow-Origin on their free tier
// and break the dashboard the moment viem rotates onto them. Override-all
// possible via NEXT_PUBLIC_RPC_URL (set to your Alchemy/Infura URL on Vercel).
const baseSepoliaRpcs = process.env.NEXT_PUBLIC_RPC_URL
  ? [http(process.env.NEXT_PUBLIC_RPC_URL)]
  : [
      http("https://sepolia.base.org"),
      http("https://base-sepolia-rpc.publicnode.com"),
      http("https://base-sepolia.gateway.tenderly.co"),
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
