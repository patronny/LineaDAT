import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { StrategyStatsHero } from "@/components/strategy-stats";
import { BagsForSaleClient } from "@/components/bags-for-sale";
import { ActivityFeedClient } from "@/components/activity-feed";
import { TradeWidgetClient } from "@/components/trade-widget";
import { SwapHistoryTable } from "@/components/swap-history";
import { Card } from "@/components/ui/card";

/**
 * /strategies/[address] — full replica of tokenstrategy.com/strategies/0x... but adapted to LINEASTR/tLINEA.
 *
 * Layout (desktop, ≥1024px):
 *
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ Header (sticky)                                         │
 *   ├─────────────────────────────────────────────────────────┤
 *   │ Strategy hero: name + symbol + address + chain badge    │
 *   ├─────────────────────────────────────────────────────────┤
 *   │ 4-tile stats grid (StrategyStatsHero)                   │
 *   ├──────────────────────────────────────┬──────────────────┤
 *   │ LEFT: Bags for sale + Activity feed  │ RIGHT: Trade     │
 *   │   (66%)                              │   widget (33%)   │
 *   └──────────────────────────────────────┴──────────────────┘
 *
 * Mobile (<768px):
 *   - Stat tiles 2x2
 *   - Trade widget moves up (above bags) for thumb-reach access
 *   - Bags + activity become collapsible accordions
 */
export default async function StrategyPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  return (
    <>
      <Header />

      <main className="min-h-[calc(100vh-3.5rem)] py-6 sm:py-10">
        <div className="container">
          {/* Strategy header */}
          <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/30 font-mono uppercase tracking-wider">
                  Base Sepolia
                </span>
                <span className="text-xs text-muted-foreground font-mono">{address}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-display font-bold">
                LINEASTR
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">
                Backed by $LINEA. 20% markup per cycle. Burned forever.
              </p>
            </div>
          </div>

          {/* Stats hero — 4 tiles */}
          <StrategyStatsHero />

          {/* MOBILE: Trade widget appears first (above bags + activity) */}
          <div className="lg:hidden mb-6">
            <TradeWidgetClient />
          </div>

          {/* DESKTOP: Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Left column: Bags for sale + Activity feed */}
            <div className="lg:col-span-2 space-y-4 sm:space-y-6">
              <Card>
                <div className="p-4 sm:p-6">
                  <h2 className="text-lg sm:text-xl font-display font-semibold mb-4">
                    Bags for sale
                  </h2>
                  <BagsForSaleClient />
                </div>
              </Card>

              <Card>
                <div className="p-4 sm:p-6">
                  <h2 className="text-lg sm:text-xl font-display font-semibold mb-4">
                    Recent activity
                  </h2>
                  <ActivityFeedClient />
                </div>
              </Card>
            </div>

            {/* Right column: Trade widget (desktop only) */}
            <div className="hidden lg:block">
              <div className="sticky top-24">
                <TradeWidgetClient />
              </div>
            </div>
          </div>

          {/* Bottom: last 10 swap transactions */}
          <Card className="mt-4 sm:mt-6">
            <div className="p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-display font-semibold mb-4">
                Recent swaps
              </h2>
              <SwapHistoryTable />
            </div>
          </Card>
        </div>
      </main>

      <Footer />
    </>
  );
}
