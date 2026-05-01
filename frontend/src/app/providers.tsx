"use client";

import { useEffect, useState } from "react";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";

import { config } from "@/lib/wagmi-client";

import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2,
      staleTime: 10_000,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"luxury" | "linea" | "cyberpunk">("luxury");

  useEffect(() => {
    const stored = localStorage.getItem("lineastr-theme") as typeof theme | null;
    if (stored === "luxury" || stored === "linea" || stored === "cyberpunk") {
      setTheme(stored);
    }
    document.documentElement.setAttribute("data-theme", stored ?? "luxury");
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={theme === "linea" ? lightTheme() : darkTheme()}
          initialChain={84532}
          showRecentTransactions={true}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
