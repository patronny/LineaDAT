import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ADDR } from "@/lib/wagmi";

/**
 * Landing page — the marketing hero.
 *
 * Layout:
 *   - Hero with big CTA "Buy LINEASTR" → /strategies/[address]
 *   - 3-tile feature grid (slow-rug protection / deflation / open source)
 *   - Mechanics explainer
 *   - Theme switcher (in header on mobile, also persistent CTA at bottom)
 */
export default function HomePage() {
  return (
    <>
      <Header />

      <main className="min-h-[calc(100vh-3.5rem)]">
        {/* HERO */}
        <section className="container py-12 sm:py-16 md:py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 text-xs font-mono uppercase tracking-wider rounded-full border border-primary/30 bg-primary/10 text-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Live on Base Sepolia
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold tracking-tight leading-[1.1]">
              The Linea-backed
              <br />
              <span className="text-primary">deflationary</span> strategy.
            </h1>
            <p className="mt-6 text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl">
              LINEASTR is a fork of TokenStrategy v3 calibrated for $LINEA. Buy bags of LINEA
              with ETH, sell them back at a 20% markup. The protocol burns LINEASTR forever.
              Slow-rug protected, fully on-chain, MIT licensed.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button size="xl" asChild>
                <Link href={`/strategies/${ADDR.strategy}` as never}>
                  Buy LINEASTR
                </Link>
              </Button>
              <Button size="xl" variant="outline" asChild>
                <Link href="/about">How it works</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* FEATURE GRID */}
        <section className="container py-8 sm:py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <Card className="p-6 sm:p-8">
              <div className="text-3xl mb-3"></div>
              <h3 className="text-lg font-display font-semibold mb-2">Slow-rug protected</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The bot's max-buy is bounded by a per-block ramp.
                Even if a single bot drains all available fees, no front-runner can extract more than
                <span className="font-mono"> currentFees</span>.
              </p>
            </Card>
            <Card className="p-6 sm:p-8">
              <div className="text-3xl mb-3"></div>
              <h3 className="text-lg font-display font-semibold mb-2">Deflationary by design</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Every sold bag pushes ETH into a TWAP buy-and-burn. Total supply only decreases.
                Treasury LINEA only grows.
              </p>
            </Card>
            <Card className="p-6 sm:p-8">
              <div className="text-3xl mb-3"></div>
              <h3 className="text-lg font-display font-semibold mb-2">Open source</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                MIT license, full Foundry test suite (134+ tests passing), 1000-cycle Anvil fork
                stress test. Code is the law.
              </p>
            </Card>
          </div>
        </section>

        {/* MECHANICS */}
        <section className="container py-8 sm:py-12">
          <Card className="p-6 sm:p-10">
            <h2 className="text-2xl sm:text-3xl font-display font-bold mb-4">How LINEASTR works</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm sm:text-base text-muted-foreground leading-relaxed">
              <div>
                <h4 className="text-foreground font-semibold mb-2">1. Bot buys a bag</h4>
                <p>
                  Anyone can call <span className="font-mono text-foreground">buyTokens()</span> to deposit
                  150 000 LINEA into the strategy and receive <span className="font-mono text-foreground">availableFunds()</span> ETH.
                </p>
              </div>
              <div>
                <h4 className="text-foreground font-semibold mb-2">2. Bag listed at 1.2× markup</h4>
                <p>
                  The strategy lists the bag at <span className="font-mono text-foreground">paid × 1.2</span>.
                  Anyone can buy it back by sending exactly that much ETH.
                </p>
              </div>
              <div>
                <h4 className="text-foreground font-semibold mb-2">3. ETH accumulates → TWAP burn</h4>
                <p>
                  Sold-bag ETH lands in <span className="font-mono text-foreground">ethToTwap</span>. Once it's
                  enough, anyone can call <span className="font-mono text-foreground">processTokenTwap()</span> to
                  buy LINEASTR on Uniswap v4 and burn it. The caller earns 0.5% reward.
                </p>
              </div>
              <div>
                <h4 className="text-foreground font-semibold mb-2">4. Slow-rug ceiling</h4>
                <p>
                  <span className="font-mono text-foreground">getMaxPriceForBuy()</span> grows linearly per block.
                  No bot can drain more than the natural fee accumulation, so frontrunning is economically pointless.
                </p>
              </div>
            </div>
          </Card>
        </section>
      </main>

      <Footer />
    </>
  );
}
