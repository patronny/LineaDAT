/**
 * Shared Type / Scope pills for DATs - used by the /dats table and the DAT
 * page header. Each badge carries a hover tooltip explaining the mechanic.
 *
 * Scope semantics (owner clarification 2026-06-11): main/side is NOT a type -
 * it is whether the DAT is the principal strategy ON ITS NETWORK. Every
 * network gets exactly one MAIN and any number of SIDE DATs; sides pay 1% of
 * their entire trading volume to buy back and burn their network's main DAT.
 */

export type DatTypeKind = "classic" | "yield";
export type DatScopeKind = "main" | "side";

/** Type pill: Classic (relist flywheel) vs Yield (treasury earns, never sells). */
export function TypeBadge({ type }: { type: DatTypeKind }) {
  const classic = type === "classic";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase cursor-help ${
        classic ? "bg-cyan-500/15 text-cyan-400" : "bg-amber-500/15 text-amber-400"
      }`}
      title={
        classic
          ? "Classic DAT: the treasury buys bags of the underlying and relists them at a 1.2x markup; the profit buys back and burns the token."
          : "Yield DAT: the treasury never sells - it earns yield on its holdings and once a week uses the income to buy back and burn its token."
      }
    >
      {classic ? "Classic" : "Yield"}
    </span>
  );
}

/** Scope pill: the main DAT of its network vs a side DAT feeding that main's burn. */
export function ScopeBadge({ scope }: { scope: DatScopeKind }) {
  const main = scope === "main";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase cursor-help ${
        main ? "bg-pink-500/15 text-pink-400" : "bg-purple-500/15 text-purple-400"
      }`}
      title={
        main
          ? "Main DAT of its network: every side DAT on the same network pays 1% of its entire trading volume to buy back and burn this token. Each network has its own main DAT."
          : "Side DAT: pays 1% of its entire trading volume to buy back and burn its network's main DAT, on every single trade."
      }
    >
      {main ? "Main" : "Side"}
    </span>
  );
}
