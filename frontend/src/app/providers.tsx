"use client";

import dynamic from "next/dynamic";

/**
 * Client-only wrapper for the actual Providers (WagmiProvider + RainbowKit + QueryClient).
 *
 * Why dynamic with ssr:false?
 *   wagmi/RainbowKit v2 uses `indexedDB` (browser-only) for connector storage even with
 *   `ssr: true` in `getDefaultConfig`. During Vercel prerendering Node.js attempts to evaluate
 *   the WagmiProvider tree and crashes with `ReferenceError: indexedDB is not defined`.
 *
 *   The fix is to never render the wagmi tree on the server — load it only in the browser.
 *   This is the canonical solution from wagmi/RainbowKit docs for Next.js 15 App Router.
 *
 * Trade-off: a brief flash of "no header / no connect button" on initial page load before JS
 *   hydrates. Acceptable, and stat tiles + page content render normally because they don't
 *   depend on wagmi to mount (they show "—" until data loads).
 */
const InnerProviders = dynamic(
  () => import("./providers-impl").then((mod) => mod.Providers),
  {
    ssr: false,
    loading: () => null,
  }
);

export function Providers({ children }: { children: React.ReactNode }) {
  return <InnerProviders>{children}</InnerProviders>;
}
