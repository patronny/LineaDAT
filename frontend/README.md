# LINEASTR Frontend

Phase 3 frontend for LINEASTR — Next.js 15 + Tailwind 3 + shadcn-style components + RainbowKit 2 + wagmi 2 + viem 2.

## Stack

- **Next.js 15** (App Router, typed routes, RSC where possible)
- **React 19**
- **Tailwind CSS 3.4** + CSS variables for the 3 design palettes (luxury / linea / cyberpunk)
- **shadcn-style components** (locally maintained — no Radix dep, just `class-variance-authority` + `tailwind-merge`)
- **RainbowKit 2** for wallet UI
- **wagmi 2 + viem 2** for on-chain reads + writes
- **lucide-react** for icons
- **@tanstack/react-query** (used internally by wagmi)

## Pages

- `/` — Landing with hero CTA, mechanics explainer, theme switcher
- `/strategies` — Index of all known strategies (Phase 3: just LINEASTR)
- `/strategies/[address]` — Full strategy page replica of tokenstrategy.com (4 stat tiles + bags-for-sale + activity feed + trade widget with buy / faucet / twap tabs)
- `/launch` — Placeholder for Phase 4 launchpad
- `/about` — Mechanics, slow-rug protection, roadmap

## Design palettes

Three palettes are wired up via `data-theme` attribute on `<html>`:

- `data-theme="luxury"` — dark luxury (default, like tokenstrategy.com — black + gold)
- `data-theme="linea"` — Linea brand (warm cream + green + orange)
- `data-theme="cyberpunk"` — synthetic neon (deep blue-black + magenta + cyan)

Switch via the `<ThemeSwitcher>` component in the header. Selection persists in `localStorage`.

## Mobile responsiveness

Tailored layouts for:
- **iPhone SE (375px)** — single-column, trade widget moves above bags, header collapses to mobile theme switcher row
- **iPhone 14/15 Pro (390-430px)** — same as SE with more breathing room
- **iPad (768px)** — 2-col stat grid, bags+activity stack, trade widget stays bottom
- **Desktop (≥1024px)** — 4-col stat grid, bags-for-sale + activity in 2/3 col, trade widget sticky in 1/3

All touch targets `≥ 44px` per WCAG AA. Tabular numerics on stats. `font-display` swap.

## Dev

```bash
cd frontend
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_*_ADDRESS after running forge script DeployBaseSepolia
npm install
npm run dev
```

Open http://localhost:3000.

## Build

```bash
npm run build && npm start
```

## Deploy (Vercel)

1. Push the repo to GitHub (already done)
2. Import on Vercel → connect to `patronny/LINEASTR`, root directory = `frontend/`
3. Add env vars from `.env.local.example` in Vercel dashboard
4. Deploy

Vercel autodetects Next.js and configures everything else. Free tier is plenty for Phase 3 testnet traffic.

## Production checklist (Phase 3 → Phase 4)

- [ ] Get a real WalletConnect projectId from https://cloud.walletconnect.com
- [ ] Switch RPC to a paid tier if needed (Alchemy / QuickNode)
- [ ] Add Vercel Analytics for Lighthouse + Web Vitals tracking
- [ ] Buy `lineastrategy.com`, point to Vercel
- [ ] Verify all contracts on Basescan / Lineascan
- [ ] Add Sentry for error tracking
- [ ] Add `robots.txt` + sitemap.xml
- [ ] Run `npm audit --production` and patch any criticals
