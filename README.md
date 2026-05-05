# on-chainDAT / LineaDAT

> **Brand reorg (2026-05-05).** Project umbrella renamed to **on-chainDAT** ([on-chaindat.com](https://on-chaindat.com)). First launch on mainnet будет **LineaDAT** (token `$LINEADAT`) — той же архитектурой, что описана ниже. Phase 3 testnet продолжает работать под именем **LineaDAT** на Base Sepolia (deployed contracts не трогаем — доживут до Phase 4 cutover). Repo: `patronny/LineaDAT`.

---

# LineaDAT (Phase 3 testnet — текущий код)

**LineaDAT** ($LINEADAT) — ERC-20 strategy token на **Linea L2** с underlying **$LINEA**. Точная архитектурная копия `wBTCStrategy` (ERC20Strategy v3 от TokenWorks, MIT) с минимальными правками: PNKSTR-burn заменён на **LineaDAT-burn** (с edge-case «LineaDAT-burn = feeAddress пока collection == LineaDAT_ADDRESS» — для запуска первого токена), параметры калиброваны под Linea (block-time, ликвидность $LINEA, экономика бота).

## Ключевое в одну строку

10% trade-fee на каждом swap → **80% treasury** (накопление ETH под выкуп $LINEA через P2P-оффер) + **20% создателю** (через redirect 10% LineaDAT-burn в feeAddress пока collection == сам $LINEADAT) → автоматический yoyo-цикл buy/relist 1.2× → buy-and-burn LineaDAT через `processTokenTwap`.

## Чем отличается от прототипа wBTCStrategy

| Аспект | wBTCStrategy (прототип v3) | LineaDAT |
|---|---|---|
| Сеть | Ethereum mainnet (12s/block) | **Linea L2** (chainId 59144, ~3s/block) |
| Underlying | wBTC `0x2260fac5…c2c599` (8 decimals) | **$LINEA** `0x1789e004…bb04` (18 decimals) |
| Total supply | 1 000 000 000 × 10¹⁸ | **1 000 000 000 × 10¹⁸** (то же) |
| Initial pool | single-sided 0 ETH + 1B WBTCSTR | **single-sided 0 ETH + 1B LineaDAT** |
| Initial FDV | ≈ $100 000 (sqrtPriceX96-derived) | **≈ $100 000** (то же) |
| `bagSize` | 0.0125 wBTC ≈ $1 250 ≈ 0.54 ETH | **150 000 LINEA** ≈ $546 ≈ 0.236 ETH |
| `buyIncrement` | 0.1 ETH/блок (mainnet 12s ⇒ 0.5 ETH/мин) | **0.02 ETH/блок** (Linea 3s ⇒ ~0.4 ETH/мин) |
| `priceMultiplier` | 1200 (1.2×) | **1200 (1.2×)** |
| `twapIncrement` | 1.0 ETH | **0.05 ETH** (раскачаем руками когда пул вырастет) |
| `twapDelayInBlocks` | 1 (12 секунд эквивалент) | **4 (12 секунд эквивалент)** |
| Buy-fee curve | 99% → 10% за 89 минут (−100bps/мин) | **то же** (копия) |
| Sell fee | 10% константа | **то же** |
| Effective fee split | 90% treasury / 10% PNKSTR-burn / 0% feeAddress (т.к. `feeAddressClaimedByOwner=0`) | **80% treasury / 10% LineaDAT-burn-redirected-to-creator / 10% creator** = **80/20 эффективно** |
| LineaDAT-burn block | PNKSTR-burn (hard-coded) | **LineaDAT-burn (если collection ≠ LineaDAT_ADDRESS), else в feeAddress** |
| Hook permissions | `beforeInitialize \| afterAddLiquidity \| afterSwap \| afterSwapReturnDelta` | **то же (паттерн v3)** |
| Owner / renounce | TokenWorks owner не renounced (4+ месяца) | **owner = твой Keycard EOA**, **renounce «никогда» с возможностью в любой момент** |
| Аудит | Нет (Etherscan: «No Contract Security Audit Submitted») | Нет (slither + aderyn + manual review + 2-фазный публичный testnet) |
| Атрибуция | — | **MIT header «based on TokenWorks ERC20Strategy v3»** |

## Статус

🟢 **Этап 1 — спецификация согласована.** Все параметры залочены (см. [`docs/50-lineadat-spec.md`](docs/50-lineadat-spec.md)). Контракты пока не написаны — это следующий этап.

## Документы

- [`docs/00-overview.md`](docs/00-overview.md) — пitch проекта, ключевые числа, статус
- [`docs/10-rektstr-v2-anatomy.md`](docs/10-rektstr-v2-anatomy.md) — глубокий разбор REKTSTR (ERC20Strategy v2, первый ERC-20 strategy)
- [`docs/20-wbtcstr-v3-anatomy.md`](docs/20-wbtcstr-v3-anatomy.md) — глубокий разбор WBTCSTR (ERC20Strategy v3, наш основной прототип)
- [`docs/30-tokenworks-incidents.md`](docs/30-tokenworks-incidents.md) — все публично известные инциденты TokenWorks с математикой slow-rug
- [`docs/40-linea-infrastructure.md`](docs/40-linea-infrastructure.md) — Uniswap v4 deployments на Linea, $LINEA token, ликвидность по DEX
- [`docs/50-lineadat-spec.md`](docs/50-lineadat-spec.md) — **финальная спека LineaDAT** (контракты, параметры, fee, бот, UI)
- [`docs/60-deployment-runbook.md`](docs/60-deployment-runbook.md) — Anvil fork + Base Sepolia + Linea mainnet (пошагово)
- [`docs/sources.md`](docs/sources.md) — все ссылки

Дополнительные данные:
- [`research/tokenworks-sources/`](research/tokenworks-sources/) — verified исходники WBTCSTR v3 (Etherscan)
- [`research/tokenworks-hook/`](research/tokenworks-hook/) — verified исходники WBTCSTR v3 hook
- [`research/rektstr-v2/`](research/rektstr-v2/) — verified исходники REKTSTR v2 (Sourcify)
- [`research/raw-rpc-data/`](research/raw-rpc-data/) — сырые receipt'ы и call-traces launch tx прототипов

## Атрибуция

TokenStrategy / PunkStrategy / NFTStrategy / wBTCStrategy сделал **Adam Lizek (`@Rhynotic`)** в составе **TokenWorks** ([token.works](https://token.works/), GitHub `TOKEN-WORKS`). Юр.лицо: **Token Workshop, Inc.** Все TokenWorks-исходники под **MIT** — мы форкаем с MIT-header'ом «based on TokenWorks ERC20Strategy v3», ровно как и положено по лицензии.

**Это НЕ Adam McBride** ([@adamamcbride](https://x.com/adamamcbride)) — он NFT-археолог, никак не связан с TokenWorks. Эта путаница встречается часто.
