import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { DatsExplorer } from "@/components/dats-explorer";

/**
 * /dats - index of all known DATs on the current chain, with the filter bar
 * (network / type / scope / sort). The interactive content lives in the
 * DatsExplorer client component.
 */
export default function StrategiesIndexPage() {
  return (
    <>
      <Header />
      <DatsExplorer />
      <Footer />
    </>
  );
}
