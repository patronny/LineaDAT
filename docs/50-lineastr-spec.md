# 50. LINEASTR — Финальная спецификация

Это **залоченная** спека. Все параметры одобрены пользователем (1 мая 2026). Любые изменения — через явный `git rm` + новая ревизия этого документа.

## 1. Идентификатор и базовая семантика

| Поле | Значение |
|---|---|
| **Token name** | `LineaStrategy` |
| **Token symbol** | **`LINEASTR`** |
| **Decimals** | 18 |
| **Total supply** | 1 000 000 000 × 10¹⁸ |
| **Underlying** | $LINEA `0x1789e0043623282D5DCc7F213d703C6D8BAfBB04` (canonical L2 token, 18 dec, не fee-on-transfer, не rebase) |
| **Network** | Linea L2 (chainId 59 144) |
| **Версия архитектуры** | ERC20Strategy v3 forked, MIT-attributed |

## 2. Ключевые параметры (final-locked)

| Параметр | Значение | Обоснование |
|---|---|---|
| `bagSize` | **150 000 LINEA** = 150 000 × 10¹⁸ | $546 ≈ 0.236 ETH; 1.97% TVL топ-пула, slippage ~2%, см. §6 |
| `buyIncrement` | **0.02 ETH/блок** = 20 × 10¹⁵ wei | catch-up bagSize ≈ 12 блоков ≈ 36 секунд при Linea 3-сек блоках |
| `priceMultiplier` | **1200** (= 1.2× markup) | копия v3, бот зарабатывает 20% премию |
| `twapIncrement` | **0.05 ETH** = 5 × 10¹⁶ wei | conservative для тонкого пула, поднимаем `setTwapIncrement` руками когда пул вырастет |
| `twapDelayInBlocks` | **4** (= 12 секунд на Linea) | защита от same-block sandwich MEV; эквивалент mainnet `1×12с` |
| `STARTING_BUY_FEE` | **9 900** bps (99%) | копия v3 |
| `DEFAULT_FEE` | **1 000** bps (10%) — buy after decay AND sell всегда | копия v3 |
| Buy-fee decay rate | **−100 bps/мин** | копия v3, плато за 89 мин |
| Fee split (technical) | **80% / 10% / 10%** = treasury / LINEASTR-burn / creator | копия v3, см. §3 |
| Fee split (effective for $LINEASTR self-launch) | **80% / 20%** = treasury / creator | edge-case: LINEASTR-burn redirected в feeAddress пока collection == LINEASTR_ADDRESS |

## 3. Fee split — точная логика

Источник для модификации: [`research/tokenworks-hook/ERC20StrategyHook.sol:_processFees`](../research/tokenworks-hook/ERC20StrategyHook.sol).

### Patch v3 → LINEASTR версия

```solidity
// LINEASTR-version of _processFees:
function _processFees(address collection, uint256 feeAmount) internal {
    if (feeAmount == 0) return;

    uint256 depositAmount   = (feeAmount * 80) / 100;     // 80% всегда treasury
    uint256 lineastrAmount  = (feeAmount * 10) / 100;     // 10% LINEASTR-burn (renamed from PNKSTR)
    uint256 ownerAmount     = feeAmount - depositAmount - lineastrAmount;  // 10% creator

    // === EDGE CASE: для самого LINEASTR-токена 10% LINEASTR-burn redirected в feeAddress ===
    if (collection == LINEASTR_ADDRESS) {
        // На самом $LINEASTR жгать самого себя через factory некуда
        // → отправляем в feeAddress (creator), эффективный split 80/20
        SafeTransferLib.forceSafeTransferETH(feeAddress, lineastrAmount);
    } else {
        // Для будущих strategies на Linea: 10% → factory → swap ETH→LINEASTR → 0xdead
        SafeTransferLib.forceSafeTransferETH(address(strategyFactory), lineastrAmount);
    }

    // 10% creator (или плюсуется к treasury если feeAddressClaimedByOwner=0)
    address feeRecipient = feeAddressClaimedByOwner[collection];
    if (feeRecipient == address(0)) {
        depositAmount += ownerAmount;
    } else {
        SafeTransferLib.forceSafeTransferETH(feeRecipient, ownerAmount);
    }

    INFTStrategy(collection).addFees{value: depositAmount}();
}
```

### Что нужно установить при initialize

`feeAddressClaimedByOwner[LINEASTR_PROXY] = 0x6e0d01089976093680c881CcDcB79e0D046e2433` (наш feeAddress).

⚠️ **Если не установить** — ownerAmount сольётся в treasury (как у WBTCSTR), creator получит 0 от sell-fees. Это **обязательный шаг** в deployment runbook.

### Эффективные схемы

**Для $LINEASTR (self-launch):**
- 80% treasury (через `addFees`)
- 10% creator (LINEASTR-burn redirect)
- 10% creator (`feeAddressClaimedByOwner` → feeAddress)
- = **80% treasury / 20% creator**

**Для будущего токена `$XYZSTR` (например $ETHSTR на Linea):**
- 80% treasury (накапливает ETH под выкуп ETH-bag — ну, фигурально, под underlying)
- 10% LINEASTR-burn (factory → ETH→LINEASTR swap → dead)
- 10% creator
- = **80% treasury / 10% LINEASTR-burn / 10% creator**

Это **общий код**, поведение зависит от того, какой токен запущен. Это и есть «база для следующих токенов на Linea».

## 4. Initial pool (single-sided seed)

| Параметр | Значение |
|---|---|
| PoolKey.currency0 | `0x0000000000000000000000000000000000000000` (native ETH) |
| PoolKey.currency1 | `LINEASTR_PROXY_ADDRESS` (TBD после deploy) |
| PoolKey.fee | `0x800000` (DYNAMIC_FEE_FLAG) |
| PoolKey.tickSpacing | 60 |
| PoolKey.hooks | `LINEASTR_HOOK_ADDRESS` (TBD после CREATE2 mining) |
| Initial sqrtPriceX96 | калибруется под `1 ETH ≈ 40 000 000 LINEASTR` (currentTick ≈ +175 052 при 18-decimal обоих сторон) |
| Initial price 1 LINEASTR | ≈ $0.0001 (при ETH=$2 317) |
| Initial FDV | ≈ $100 000 |
| ModifyLiquidity range | tickLower = −887 220, tickUpper ≈ +175 020 (32 тика ниже initial tick для single-sided lock) |
| Liquidity reserves | 0 ETH + ~1 000 000 000 LINEASTR (минус ~1k wei на rounding) |
| LP-NFT (PositionManager) | tokenId TBD → minted to `0x000…dEaD` сразу |

**Точный sqrtPriceX96** при ETH ≈ $2 317 на момент launch будет пересчитан скриптом deploy: цель — initial price `1 LINEASTR = (target_FDV $100k) / 1B / ETH_price = $0.0001 / $2 317 = 4.3 × 10⁻⁸ ETH = 4.3 × 10¹⁰ wei = 1 LINEASTR / 23 165 248 ETH-units`.

`sqrtPriceX96 = sqrt(token1/token0) × 2⁹⁶`. Если `token1/token0 = 23 165 248` (LINEASTR per ETH), то `sqrtP = 4 813.03`, `sqrtPriceX96 = 4 813.03 × 2⁹⁶ ≈ 3.81 × 10²⁹`. Сценарий пересчитаем точно в момент deploy под текущий ETH price.

## 5. Bot architecture

### 5.1 Deployment

| Компонент | Технология | Хост |
|---|---|---|
| **Bot A** (primary) | Node.js 22 + TypeScript + viem v2 | fly.io EU region (Frankfurt) |
| **Bot B** (standby) | identical | fly.io US region (Ashburn) |
| **Heartbeat / failover** | fly.io healthcheck → автоматический перезапуск; Discord webhook alert при > 5 минут downtime | |
| **Monitoring** | Discord webhook (real-time logs) + simple dashboard на Vercel (read-only RPC) | |

### 5.2 Working capital

| Бот | ETH на кошельке (старт) |
|---|---|
| **Bot A** | **2 ETH** (≈$4 634) |
| **Bot B** (standby) | **1 ETH** (≈$2 317) |
| **Total upfront** | **3 ETH** ≈ **$6 951** |

При успешном steady-state капитал растёт (каждый цикл +0.04 ETH профита). Если упадёт ниже **0.5 ETH** на боте — Discord alert, ты доливаешь с holdings.

### 5.3 Bot algorithm (псевдокод)

```typescript
async function tick() {
  const fees     = await read('currentFees', LINEASTR_PROXY);
  const maxBuy   = await read('getMaxPriceForBuy', LINEASTR_PROXY);
  const avail    = min(fees, maxBuy);

  // Quote $LINEA price через aggregator (Lynex / Etherex / KyberSwap / Odos)
  const linePrice = await bestQuote('LINEA', 'WETH', BAG_SIZE_LINEA);  // ETH per bag
  const breakeven = linePrice + GAS_BUFFER;                             // ~0.005 ETH gas

  // Conservative mode: 10% buffer вместо 5% (риск меньше, циклы реже)
  if (avail >= breakeven * 1.10) {
    // Atomic-ish (multicall если поддерживается, иначе 2 raw txs):
    await buy_LINEA_via_aggregator(BAG_SIZE_LINEA);
    await approve(LINEA, LINEASTR_PROXY, BAG_SIZE_LINEA);
    await call('buyTokens()', LINEASTR_PROXY);
    log(`+cycle profit ≈ ${avail - linePrice} ETH`);
  }
}

setInterval(tick, BLOCK_TIME_MS);  // 3000ms
```

### 5.4 Failover logic

- Bot B каждые 60 секунд читает `lastBuyBlock` через RPC. Если за **3 минуты** `lastBuyBlock` не двигался **И** `availableFunds() ≥ marketPrice × 1.10` (= условие срабатывания) — это значит Bot A молчит. Bot B берёт работу.
- При возвращении Bot A: оба видят что `lastBuyBlock` свежий, оба возвращаются к нормальному режиму (B ждёт триггера).

## 6. Frontend

| Параметр | Значение |
|---|---|
| **Стек** | Next.js 15 (App Router) + wagmi v2 + RainbowKit + viem + TailwindCSS |
| **Хостинг** | Vercel (free tier) |
| **Domain** | `lineastrategy.com` (купишь за неделю до launch на GoDaddy) |
| **Структура** | одностраничник: hero (price + supply + burned + treasury holdings) → swap card (ETH↔LINEASTR через UniversalRouter V2_1_1) → buy-target $LINEA card (вызывает наш `buyTokens()` с поддержкой aggregator-route) → recent trades feed → footer |
| **Дизайн** | 3 варианта на выбор: (a) Linea-style blue, (b) dark/neon, (c) academic minimalism. Финальный выбор перед mainnet deploy |

## 7. Owner и admin policy

| Поле | Значение |
|---|---|
| **Owner** | твой Keycard EOA (адрес TBD когда сгенеришь) |
| **`feeAddress`** | `0x6e0d01089976093680c881CcDcB79e0D046e2433` |
| **Renounce** | **«Никогда» с возможностью в любой момент** — на старте non-renounced, при необходимости (например, если найдут критичный баг и мы успешно его пофиксили) renounce делается одной транзакцией `transferOwnership(0xdead)` или `renounceOwnership()` |
| **Admin functions, доступные owner** | `updateHookAddress`, `setDistributor`, `_authorizeUpgrade` (UUPS), `setPriceMultiplier` (через factory), `updateBagSize` (только пока `lastBagId == 0`), `setTwapIncrement` (планируется добавить как `onlyOwner` setter поверх v3) |

## 8. Что нужно изменить в v3-сурсах для LINEASTR

Список конкретных правок относительно [`research/tokenworks-sources/`](../research/tokenworks-sources/) и [`research/tokenworks-hook/`](../research/tokenworks-hook/):

### `BaseStrategy.sol`
- [ ] Добавить MIT-header `// Based on TokenWorks ERC20Strategy v3 (MIT). Original: token.works`
- [ ] Сменить `GLOBAL_DISTRIBUTION_HANDLER` (на mainnet hardcoded `0xDf99…9B2D`) — на адрес для Linea **или ноль** (в коде есть fallback `block.chainid == 1 ? CONST : globalDistributor`, для Linea будет использоваться `globalDistributor` storage var, который owner устанавливает через `setGlobalDistributor`)
- [ ] Добавить `setTwapIncrement(uint256)` `onlyOwner` setter (нужен для раскачки twapIncrement когда пул вырастет; в v3 такого нет — нужно добавить аккуратно)
- [ ] **Storage layout не меняем** — все поля в том же порядке для совместимости с indexer'ами

### `ERC20Strategy.sol`
- [ ] Добавить MIT-header
- [ ] `VERSION()` → возвращает 3 (мы форкаем v3, не делаем 4)
- [ ] Логика `buyTokens` / `sellTokens` / `list` / `updateBagSize` — без изменений

### `ERC20StrategyHook.sol`
- [ ] Добавить MIT-header
- [ ] Переименовать `IPunkStrategy punkStrategy` → `address lineastrAddress`
- [ ] В `_processFees`:
  - переименовать `pnkstrAmount` → `lineastrAmount`
  - добавить ветку `if (collection == lineastrAddress) { send to feeAddress } else { send to factory for buy-and-burn }`
- [ ] Переименовать ошибки `NotNFTStrategy` → `NotStrategy`, `NotNFTStrategyFactoryOwner` → `NotStrategyFactoryOwner`
- [ ] Переименовать event `Trade.nftStrategy` → `strategy`

### Factory (новый, наш — TokenWorks factory не используем)
- [ ] Свой минимальный factory, deploy LINEASTR proxy + hook + initialize pool + seed liquidity + send LP-NFT в dead. Инспирация — TokenWorks Factory `0x9f834e16…000a0a`, но мы не клонируем launchpad-логику (нам не нужен `ownerLaunchStrategy` permissionless flow).
- [ ] Factory держит `LINEASTR_ADDRESS` immutable — после первого deploy он зафиксирован
- [ ] Factory имеет логику для buy-and-burn LINEASTR (получает ETH из hook через `forceSafeTransferETH`, свопает ETH→LINEASTR через UniversalRouter V2_1_1, шлёт на dead) — это используется только на будущих strategies, не на самом LINEASTR

## 9. Параметры для `initialize()`

```solidity
// Deploy script — псевдокод
LINEASTRStrategy proxy = factory.deployStrategy({
    underlying:        0x1789e0043623282D5DCc7F213d703C6D8BAfBB04,  // $LINEA
    bagSize:           150_000 * 1e18,                              // 150 000 LINEA
    hook:              minedHookAddress,                            // CREATE2-mined
    tokenName:         "LineaStrategy",
    tokenSymbol:       "LINEASTR",
    buyIncrement:      0.02 ether,                                  // 2 × 10¹⁶ wei
    owner:             ownerKeycardEOA
});

// После initialize:
hook.adminUpdateFeeAddress(
    address(proxy),
    0x6e0d01089976093680c881CcDcB79e0D046e2433  // feeAddressClaimedByOwner[LINEASTR] = creator
);

proxy.setPriceMultiplier(1200);   // 1.2× markup (default уже 1200, но фиксируем явно)
// twapIncrement default = 1 ETH в v3, нам нужно 0.05 ETH — добавляем setter:
proxy.setTwapIncrement(0.05 ether);
proxy.setTwapDelayInBlocks(4);    // 12 секунд на Linea
```

## 10. Безопасность — чек-лист до deploy

- [ ] **Slither** на все .sol файлы — 0 high/medium findings
- [ ] **Aderyn** — 0 high findings
- [ ] **Foundry tests** — 100+ scenarios:
  - happy path: buy → sell → buy-and-burn cycle
  - bot front-running: 2 ботов на одном блоке, конкуренция
  - slow-rug attempt: bot ждёт N блоков, проверяем, что `availableFunds` → bound by `currentFees`
  - sandwich attack на `processTokenTwap`
  - re-entrancy через ERC-777 underlying — но `$LINEA` не ERC-777, ок
  - empty pool: вызов `buyTokens` / `sellTokens` / `processTokenTwap` когда баланс 0
- [ ] **Manual review** Adam Lizek's mistakes из [`30-tokenworks-incidents.md`](30-tokenworks-incidents.md):
  - feeAddressClaimedByOwner установлен ✓
  - bot deployed before launch ✓
  - frontend «Buy Target $LINEA» button готова ✓
- [ ] **Anvil fork test** — 1000 циклов в ускоренной симуляции (jump 100 блоков, mine, проверка инвариантов)
- [ ] **Base Sepolia public test** — минимум 7 дней, ты тестируешь UI с реального Keycard
