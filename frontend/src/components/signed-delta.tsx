/**
 * Renders a signed percent + dollar delta with green-neon (positive) or
 * red-neon (negative) styling. Either side may be null - the column then
 * shows a plain dash. Shared across the portfolio summary and holdings table
 * so a single formatter governs every "what changed" cell on the site.
 */
export function SignedDelta({
  pct,
  usd,
  size = "sm",
}: {
  pct: number | null;
  usd: number | null;
  size?: "sm" | "md" | "lg";
}) {
  if (pct === null && usd === null) {
    return <span className="text-muted-foreground">-</span>;
  }
  // pct / usd share the same sign in practice - a price move drives both - so
  // we pick whichever is available to decide green vs red.
  const ref = pct ?? usd ?? 0;
  const sign = ref >= 0 ? "+" : "-";
  const pctText =
    pct === null ? "-" : `${sign}${Math.abs(pct).toFixed(2)}%`;
  const usdText =
    usd === null
      ? null
      : `${sign}$${Math.abs(usd).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

  const positive = ref >= 0;
  const sizeClass =
    size === "lg"
      ? "text-xl sm:text-2xl"
      : size === "md"
      ? "text-base sm:text-lg"
      : "text-sm";

  return (
    <span className={`${positive ? "neon-green" : "neon-red"} ${sizeClass} font-mono tabular`}>
      {pctText}
      {usdText ? <span className="opacity-80"> ({usdText})</span> : null}
    </span>
  );
}
