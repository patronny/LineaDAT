"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ThemeSwitcher } from "./theme-switcher";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container flex h-14 sm:h-16 items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg sm:text-xl font-display font-bold tracking-tight">
            LINEA<span className="text-primary">STR</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
            Home
          </Link>
          <Link href="/strategies" className="text-muted-foreground hover:text-foreground transition-colors">
            Strategies
          </Link>
          <Link href="/launch" className="text-muted-foreground hover:text-foreground transition-colors">
            Launch
          </Link>
          <Link href="/about" className="text-muted-foreground hover:text-foreground transition-colors">
            About
          </Link>
        </nav>

        {/* Right cluster */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:block">
            <ThemeSwitcher />
          </div>
          <ConnectButton
            accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
            chainStatus={{ smallScreen: "icon", largeScreen: "full" }}
            showBalance={{ smallScreen: false, largeScreen: true }}
          />
        </div>
      </div>

      {/* Mobile theme toggle row */}
      <div className="sm:hidden border-t border-border px-4 py-2 flex items-center justify-center">
        <ThemeSwitcher />
      </div>
    </header>
  );
}
