import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { StrategyHeader } from "@/components/strategy-header";
import { StrategyDashboard } from "@/components/strategy-dashboard";

export default async function StrategyPage({ params }: { params: Promise<{ address: string }> }) {
  await params;
  return (
    <>
      <Header />
      <main className="min-h-[calc(100vh-3.5rem)] py-4 sm:py-6">
        <div className="container">
          <StrategyHeader />
          <StrategyDashboard />
        </div>
      </main>
      <Footer />
    </>
  );
}
