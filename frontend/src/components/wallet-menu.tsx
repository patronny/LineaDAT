"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useDisconnect } from "wagmi";
import { ChevronDown, Wallet, Send, LogOut, Briefcase } from "lucide-react";
import { DEFAULT_CHAIN_ID } from "@/lib/wagmi";

// Stage-aware network list for the chain dropdown. The live network (selectable, shown with
// the active dot) is driven by NEXT_PUBLIC_CHAIN_ID; the rest are "coming soon" teasers.
const LIVE_NETWORK =
  DEFAULT_CHAIN_ID === 59144
    ? { id: 59144, name: "Linea" }
    : { id: 84532, name: "Base Sepolia" };
const COMING_SOON_NETWORKS =
  DEFAULT_CHAIN_ID === 59144
    ? ["Base (coming soon)"]
    : ["Linea (coming soon)", "Base (coming soon)"];

/**
 * Custom wallet UI that wraps RainbowKit's connect/chain logic but renders our
 * own dropdowns. The chain button opens a menu of supported networks (the live
 * one depends on NEXT_PUBLIC_CHAIN_ID); the account pill opens Portfolio / Transfer /
 * Disconnect.
 *
 * The disconnected and wrong-network states still surface RainbowKit's modals
 * via openConnectModal / openChainModal - we only replace the live-account
 * surface.
 */
export function WalletMenu() {
  const { disconnect } = useDisconnect();
  const [accountOpen, setAccountOpen] = useState(false);
  const [chainOpen, setChainOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click-outside / Esc - covers both dropdowns.
  useEffect(() => {
    if (!accountOpen && !chainOpen) return;
    function onClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
        setChainOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setAccountOpen(false);
        setChainOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen, chainOpen]);

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openConnectModal,
        openChainModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === "authenticated");

        return (
          <div
            ref={containerRef}
            className="relative flex items-center gap-2 sm:gap-2.5"
            aria-hidden={!ready}
            style={!ready ? { opacity: 0, pointerEvents: "none", userSelect: "none" } : undefined}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    type="button"
                    onClick={openConnectModal}
                    className="inline-flex items-center gap-1.5 h-9 sm:h-10 px-3 sm:px-4 rounded-md font-semibold text-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Wallet className="w-4 h-4" />
                    <span className="hidden sm:inline">Connect Wallet</span>
                    <span className="sm:hidden">Connect</span>
                  </button>
                );
              }
              if (chain.unsupported) {
                return (
                  <button
                    type="button"
                    onClick={openChainModal}
                    className="inline-flex items-center gap-1.5 h-9 sm:h-10 px-3 sm:px-4 rounded-md font-semibold text-sm bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity"
                  >
                    Wrong network
                  </button>
                );
              }
              return (
                <>
                  {/* Chain badge + dropdown of supported networks. */}
                  <div className="relative hidden sm:block">
                    <button
                      type="button"
                      onClick={() => {
                        setAccountOpen(false);
                        setChainOpen((v) => !v);
                      }}
                      aria-haspopup="menu"
                      aria-expanded={chainOpen}
                      className="inline-flex items-center gap-1.5 h-10 px-3 rounded-md border border-border bg-card text-sm font-medium hover:border-primary/40 transition-colors"
                      aria-label={`Connected to ${chain.name}`}
                    >
                      {chain.hasIcon && chain.iconUrl ? (
                        <span
                          className="w-5 h-5 rounded-full overflow-hidden"
                          style={{ background: chain.iconBackground ?? "transparent" }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={chain.iconUrl}
                            alt={chain.name ?? "chain"}
                            width={20}
                            height={20}
                            className="w-5 h-5"
                          />
                        </span>
                      ) : null}
                      <span className="truncate max-w-[7rem]">{chain.name}</span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                    </button>

                    {chainOpen ? (
                      <div
                        role="menu"
                        className="absolute right-0 top-full mt-2 w-52 rounded-md border border-border bg-card overflow-hidden z-50"
                        style={{
                          boxShadow:
                            "0 0 0 1px hsl(var(--primary) / 0.15), 0 18px 40px -8px hsl(var(--primary) / 0.25)",
                        }}
                      >
                        {/* Live network (stage-aware): selectable + active dot. Tapping it
                            does nothing if it's already current; otherwise we fall through
                            to RainbowKit's chain modal to request the switch. */}
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setChainOpen(false);
                            if (chain.id !== LIVE_NETWORK.id) openChainModal?.();
                          }}
                          className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted/40"
                        >
                          <span>{LIVE_NETWORK.name}</span>
                          {chain.id === LIVE_NETWORK.id ? (
                            <span className="text-xs neon-green">●</span>
                          ) : null}
                        </button>
                        {COMING_SOON_NETWORKS.map((label) => (
                          <ComingSoonItem key={label} label={label} />
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {/* Account pill - our trigger */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setChainOpen(false);
                        setAccountOpen((v) => !v);
                      }}
                      aria-haspopup="menu"
                      aria-expanded={accountOpen}
                      className="inline-flex items-center gap-1.5 sm:gap-2 h-9 sm:h-10 pl-2 pr-2 sm:pl-3 sm:pr-2 rounded-md border border-primary/40 bg-card hover:border-primary/70 transition-colors text-sm font-medium focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {account.displayBalance ? (
                        <span className="hidden sm:inline font-mono tabular text-foreground">
                          {account.displayBalance}
                        </span>
                      ) : null}
                      <span
                        className="inline-flex items-center gap-1.5 h-7 sm:h-8 px-1.5 sm:px-2 rounded bg-muted/40"
                      >
                        <AddressAvatar address={account.address} />
                        <span className="font-mono tabular text-foreground">
                          {shortenAddr(account.address)}
                        </span>
                        <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                      </span>
                    </button>

                    {accountOpen ? (
                      <div
                        role="menu"
                        className="absolute right-0 top-full mt-2 w-48 rounded-md border border-border bg-card overflow-hidden z-50"
                        style={{
                          boxShadow:
                            "0 0 0 1px hsl(var(--primary) / 0.15), 0 18px 40px -8px hsl(var(--primary) / 0.25)",
                        }}
                      >
                        <MenuLink
                          href="/portfolio"
                          icon={<Briefcase className="w-4 h-4" />}
                          label="Portfolio"
                          onSelect={() => setAccountOpen(false)}
                        />
                        <MenuLink
                          href="/transfer"
                          icon={<Send className="w-4 h-4" />}
                          label="Transfer"
                          onSelect={() => setAccountOpen(false)}
                        />
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setAccountOpen(false);
                            disconnect();
                          }}
                          className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground border-t border-border"
                        >
                          <LogOut className="w-4 h-4" />
                          Disconnect
                        </button>
                      </div>
                    ) : null}
                  </div>
                </>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

function ComingSoonItem({ label }: { label: string }) {
  return (
    <div
      aria-disabled="true"
      className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-muted-foreground/70 cursor-not-allowed select-none"
    >
      <span>{label}</span>
    </div>
  );
}

function MenuLink({
  href,
  icon,
  label,
  onSelect,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  onSelect: () => void;
}) {
  return (
    <Link
      role="menuitem"
      href={href as never}
      onClick={onSelect}
      className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground"
    >
      {icon}
      {label}
    </Link>
  );
}

function shortenAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr || "";
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

/**
 * Deterministic 2-color gradient swatch derived from the address bytes. Cheap
 * substitute for ENS avatars when none is set.
 */
function AddressAvatar({ address }: { address: string }) {
  const hash = address?.toLowerCase() ?? "0x0";
  const h1 = (parseInt(hash.slice(2, 6) || "0", 16) % 360) || 0;
  const h2 = (parseInt(hash.slice(6, 10) || "0", 16) % 360) || 0;
  const bg = `linear-gradient(135deg, hsl(${h1} 80% 55%) 0%, hsl(${h2} 80% 45%) 100%)`;
  return (
    <span
      aria-hidden="true"
      className="inline-block w-4 h-4 rounded-full shrink-0 border border-foreground/10"
      style={{ background: bg }}
    />
  );
}
