import { SVGProps } from "react";

/**
 * Inline SVG token / network icons used in the strategy header and swap card.
 *
 *   <LineastrIcon />  - LineaDAT token mark: black disc with magenta L (same
 *                       geometry as <LineaIcon>, but pink instead of cyan).
 *                       Pink mirrors the project's --primary token and the
 *                       browser-tab favicon.
 *
 *   <LineaIcon />     - LINEA L2 network badge: cyan circle + black L. Used
 *                       inline next to chain-name text.
 *
 *   <EthIcon />       - classic Ethereum multi-tone diamond.
 *
 * All three accept any standard <svg> prop, so callers control size via
 * className (`w-5 h-5`, `w-12 h-12`, …) or width/height. None of them
 * carry their own background - they are pure marks meant to sit on top
 * of arbitrary card surfaces.
 */

const NEON_CYAN = "hsl(180 100% 50%)";
const NEON_PINK = "#ff33cc";
const INK = "#0a0a0f";

export function LineastrIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="32" cy="32" r="30" fill={INK} />
      <circle cx="32" cy="32" r="29" fill="none" stroke={NEON_PINK} strokeWidth="0.8" opacity="0.5" />
      {/* L stroke - left vertical + bottom horizontal */}
      <path
        d="M 20 14 L 20 48 L 42 48"
        stroke={NEON_PINK}
        strokeWidth="8"
        fill="none"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      {/* dot at the top-right of the L */}
      <circle cx="40" cy="16" r="3.5" fill={NEON_PINK} />
    </svg>
  );
}

export function LineaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="32" cy="32" r="30" fill={NEON_CYAN} />
      <path
        d="M 20 14 L 20 48 L 42 48"
        stroke="#0a0a0f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <circle cx="40" cy="16" r="3.5" fill="#0a0a0f" />
    </svg>
  );
}

export function EthIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 256 417" xmlns="http://www.w3.org/2000/svg" {...props}>
      <polygon fill="#343434" points="127.9,0 125.2,9.5 125.2,285.2 127.9,287.9 255.8,212.3" />
      <polygon fill="#8C8C8C" points="127.9,0 0,212.3 127.9,287.9 127.9,154.2" />
      <polygon fill="#3C3C3B" points="127.9,312.2 126.4,314 126.4,412.2 127.9,416.9 255.9,236.6" />
      <polygon fill="#8C8C8C" points="127.9,416.9 127.9,312.2 0,236.6" />
      <polygon fill="#141414" points="127.9,287.9 255.8,212.3 127.9,154.2" />
      <polygon fill="#393939" points="0,212.3 127.9,287.9 127.9,154.2" />
    </svg>
  );
}
