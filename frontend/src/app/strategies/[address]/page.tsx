import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { StrategyHeader } from "@/components/strategy-header";
import { ChartPlaceholder } from "@/components/chart-placeholder";
import { HoldingsTable } from "@/components/holdings-table";
import { SalesTable } from "@/components/sales-table";
import { SwapCard } from "@/components/swap-card";
import { FundingsCard } from "@/components/fundings-card";
import { BurnedCard } from "@/components/burned-card";
import { ActionsCard } from "@/components/actions-card";
import { Card } from "@/components/ui/card";

/**
 * /strategies/[address] — full clone of tokenstrategy.com/strategies/0x... layout,
 * adapted to LINEASTR + Base Sepolia testnet pool data.
 *
 * Layout (lg+):
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ Header                                                  │
 *   ├─────────────────────────────────────────────────────────┤
 *   │ Strategy header card: logo, name, chain, inline stats   │
 *   ├──────────────────────────────────────┬──────────────────┤
 *   │ LEFT (66%):                          │ RIGHT (33%):     │
 *   │   - Chart card                       │   - Swap card    │
 *   │   - Holdings table                   │   - Fundings     │
 *   │   - Sales table                      │   - Burned       │
 *   │                                      │   - Actions      │
 *   └──────────────────────────────────────┴──────────────────┘
 *
 * Mobile: everything stacks single column. Swap moves to top for thumb-reach.
 */
export default async function StrategyPage({ params }: { params: Promise<{ address: string }> }) {
  await params; // address read for routing only — strategy is hardcoded in env
  return (
    <>
      <Header />

      <main className="min-h-[calc(100vh-3.5rem)] py-4 sm:py-6">
        <div className="container">
          <StrategyHeader />

          {/* MOBILE: Swap surfaces above tables for thumb-reach */}
          <div className="lg:hidden mb-4 sm:mb-6">
            <SwapCard />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* LEFT */}
            <div className="lg:col-span-2 space-y-4 sm:space-y-6">
              <ChartPlaceholder />
              <Card>
                <div className="px-4 sm:px-5 py-3 border-b border-border">
                  <h2 className="font-display font-semibold text-sm uppercase tracking-wider">Holdings</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Bags currently listed for sale. Buy any bag at the listed price; ETH goes back to the
                    strategy and the bag size of tLINEA goes to your wallet.
                  </p>
                </div>
                <HoldingsTable />
              </Card>
              <Card>
                <div className="px-4 sm:px-5 py-3 border-b border-border">
                  <h2 className="font-display font-semibold text-sm uppercase tracking-wider">Sales</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Past bag sales. Profit = sold-for minus what the bot paid (1.2× markup target).
                  </p>
                </div>
                <SalesTable />
              </Card>
            </div>

            {/* RIGHT */}
            <div className="space-y-4 sm:space-y-6">
              {/* Desktop: Swap is at the top of the right column */}
              <div className="hidden lg:block">
                <SwapCard />
              </div>
              <FundingsCard />
              <BurnedCard />
              <ActionsCard />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
