"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

/**
 * Shared Type / Scope pills for DATs - used by the /dats table and the DAT
 * page header. Hover (or tap/focus on touch) shows a styled tooltip explaining
 * the mechanic - native `title` was too slow to appear and invisible on touch.
 *
 * Scope semantics (owner clarification 2026-06-11): main/side is NOT a type -
 * it is whether the DAT is the principal strategy ON ITS NETWORK. Every
 * network gets exactly one MAIN and any number of SIDE DATs; sides pay 1% of
 * their entire trading volume to buy back and burn their network's main DAT.
 */

export type DatTypeKind = "classic" | "yield";
export type DatScopeKind = "main" | "side";

type TipContent = { title: string; titleClass: string; body: string };

const TIP_HALF_W = 136; // w-64 tooltip (256px) / 2 + 8px viewport margin

/**
 * Pill + portal tooltip. The tooltip is position:fixed and portaled to <body>
 * so it escapes overflow-x-auto table wrappers and card clipping; coordinates
 * come from the pill's bounding rect, clamped so the box never leaves the
 * viewport on narrow screens.
 */
function BadgePill({
  label,
  pillClass,
  tip,
}: {
  label: string;
  pillClass: string;
  tip: TipContent;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  function show(e: React.SyntheticEvent<HTMLSpanElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(
      Math.max(r.left + r.width / 2, TIP_HALF_W),
      window.innerWidth - TIP_HALF_W,
    );
    setPos({ x, y: r.bottom + 8 });
  }
  const hide = () => setPos(null);

  return (
    <>
      <span
        tabIndex={0}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase cursor-help focus-visible:ring-2 focus-visible:ring-primary ${pillClass}`}
      >
        {label}
      </span>
      {pos !== null && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed z-[100] w-64 -translate-x-1/2 rounded-md border border-border bg-card px-3 py-2 text-xs normal-case font-normal text-left shadow-[0_4px_20px_rgba(0,0,0,0.6)] pointer-events-none"
              style={{ left: pos.x, top: pos.y }}
              role="tooltip"
            >
              <div className={`font-semibold mb-1 ${tip.titleClass}`}>{tip.title}</div>
              <p className="text-muted-foreground leading-relaxed">{tip.body}</p>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

const TYPE_TIPS: Record<DatTypeKind, TipContent> = {
  classic: {
    title: "Classic DAT",
    titleClass: "text-cyan-400",
    body: "The treasury buys bags of the underlying and relists them at a 1.2x markup; the profit buys back and burns the token.",
  },
  yield: {
    title: "Yield DAT",
    titleClass: "text-amber-400",
    body: "The treasury never sells - it earns yield on its holdings and once a week uses the income to buy back and burn its token.",
  },
};

const SCOPE_TIPS: Record<DatScopeKind, TipContent> = {
  main: {
    title: "Main DAT",
    titleClass: "text-pink-400",
    body: "The main DAT of its network: every side DAT on the same network pays 1% of its entire trading volume to buy back and burn this token. Each network has its own main DAT.",
  },
  side: {
    title: "Side DAT",
    titleClass: "text-purple-400",
    body: "Pays 1% of its entire trading volume to buy back and burn its network's main DAT, on every single trade.",
  },
};

/** Type pill: Classic (relist flywheel) vs Yield (treasury earns, never sells). */
export function TypeBadge({ type }: { type: DatTypeKind }) {
  const classic = type === "classic";
  return (
    <BadgePill
      label={classic ? "Classic" : "Yield"}
      pillClass={classic ? "bg-cyan-500/15 text-cyan-400" : "bg-amber-500/15 text-amber-400"}
      tip={TYPE_TIPS[type]}
    />
  );
}

/** Scope pill: the main DAT of its network vs a side DAT feeding that main's burn. */
export function ScopeBadge({ scope }: { scope: DatScopeKind }) {
  const main = scope === "main";
  return (
    <BadgePill
      label={main ? "Main" : "Side"}
      pillClass={main ? "bg-pink-500/15 text-pink-400" : "bg-purple-500/15 text-purple-400"}
      tip={SCOPE_TIPS[scope]}
    />
  );
}
