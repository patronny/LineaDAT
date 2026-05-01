# 60. Deployment Runbook — пошаговый план запуска LINEASTR

Полный план: написание контрактов → Anvil fork → Base Sepolia → Linea mainnet.

## Phase 0 — подготовка (текущий этап, до написания кода)

- [x] Согласована [`50-lineastr-spec.md`](50-lineastr-spec.md) (1 мая 2026)
- [x] Скачаны verified исходники прототипов: WBTCSTR v3, REKTSTR v2
- [ ] **Ты:** генерируешь Owner EOA на Keycard, присылаешь публичный адрес
- [ ] **Ты:** покупаешь `lineastrategy.com` (за неделю до launch)
- [ ] **Я:** генерирую Bot A и Bot B EOA приваты, передаю тебе через secure channel; ты держишь приваты у себя, я использую только для подписи в fly.io secrets

## Phase 1 — контракты (Этап 2)

### 1.1 Setup repo

```bash
mkdir -p contracts/{src,test,script,lib}
cd contracts
forge init --no-commit
```

### 1.2 Зависимости (Foundry)

```bash
forge install Uniswap/v4-core
forge install Uniswap/v4-periphery
forge install Uniswap/v4-router
forge install Uniswap/permit2
forge install Vectorized/solady
```

### 1.3 Файлы

Копируем из `research/tokenworks-sources/` и `research/tokenworks-hook/` в `contracts/src/`, применяя patch-list из [`50-lineastr-spec.md`§8](50-lineastr-spec.md):

```
contracts/src/
  LINEASTRStrategy.sol      ← from ERC20Strategy.sol v3 + MIT-header
  BaseStrategy.sol          ← from BaseStrategy.sol v3 + MIT-header + setTwapIncrement
  LINEASTRHook.sol          ← from ERC20StrategyHook.sol v3 + MIT-header + LINEASTR-burn rename + edge-case
  LINEASTRFactory.sol       ← новый (минимальный, не клонируем TokenWorks factory)
  Interfaces.sol            ← from src_Interfaces.sol с переименованиями
```

### 1.4 Static analysis

```bash
forge build
slither contracts/src/ --filter-paths "lib/" --exclude-informational --exclude-low
aderyn contracts/
```

Цель: 0 high/medium findings.

### 1.5 Foundry tests

```
contracts/test/
  Strategy.t.sol            ← buy/sell/list cycle
  Hook.t.sol                ← swap fee logic, _processFees variants
  SlowRug.t.sol             ← попытка slow-rug, доказываем что availableFunds bound
  Sandwich.t.sol            ← sandwich на processTokenTwap, доказываем что twapDelayInBlocks работает
  Initialize.t.sol          ← полный launch flow с initial pool seed
  Edge.t.sol                ← пустой пул, ноль fees, retry на reverted txs
```

Цель: ≥ 100 тест-кейсов, всё зелёное.

## Phase 2 — Anvil fork (локальный тест)

### 2.1 Fork Linea mainnet

```bash
anvil --fork-url https://rpc.linea.build --port 8545
# в другом терминале:
export RPC=http://localhost:8545
```

### 2.2 Deploy LINEASTR

```bash
forge script contracts/script/Deploy.s.sol \
  --rpc-url $RPC \
  --broadcast \
  --private-key 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d  # anvil[0]
```

### 2.3 Симулируем 1000 циклов

```bash
forge script contracts/script/SimulateCycles.s.sol \
  --rpc-url $RPC \
  --broadcast \
  --sig "run(uint256)" 1000
```

Скрипт:
1. Делает random swap'ы (50/50 buy/sell в нашем pool) с разными размерами
2. После каждого swap'а — `vm.roll(block.number + 5)` (jump 5 блоков)
3. Эпизодически вызывает `buyTokens()` (от bot-EOA) когда `availableFunds() ≥ marketPrice`
4. Эпизодически вызывает `sellTokens(bagId)` от random buyer
5. Когда `ethToTwap > 0.05 ETH` — вызывает `processTokenTwap()`
6. Проверяет инварианты: `currentFees ≥ 0`, `ethToTwap ≥ 0`, `totalSupply` уменьшается, `treasury LINEA` растёт

### 2.4 Логирование

Все cycles в `out/anvil-simulation.json`. Анализ:
- Avg profit бота за цикл: должен быть **> 0.03 ETH**
- Slow-rug attempts (bot ждёт > 50 блоков и пытается забрать всё): должны fail / yield ограниченную премию
- Burn-rate LINEASTR: 0.5–2% supply в неделю при $10k/день volume

## Phase 3 — Base Sepolia (публичный testnet, 7 дней)

### 3.1 Deploy

```bash
export RPC=https://base-sepolia-rpc.publicnode.com
forge script contracts/script/Deploy.s.sol \
  --rpc-url $RPC \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --private-key $DEPLOYER_PK
```

⚠️ Underlying на Base Sepolia — нет `$LINEA`. Для теста деплоим **mock `LINEA-test`** ERC-20 c initial supply 70B (== mainnet supply $LINEA).

### 3.2 Bot deployment

```bash
cd bot/
fly launch --name lineastr-bot-a-sepolia --region fra
fly secrets set BOT_PRIVATE_KEY=$BOT_A_PK RPC_URL=$RPC LINEASTR_PROXY=$DEPLOYED_PROXY
fly deploy

fly launch --name lineastr-bot-b-sepolia --region iad
# тот же private/rpc, разные регионы
```

### 3.3 Frontend

```bash
cd frontend/
vercel --prod
# деплоится на lineastr-sepolia.vercel.app
```

### 3.4 Acceptance criteria для Phase 3

- [ ] 7 дней без crashes у бота
- [ ] ≥ 50 successful buyTokens / sellTokens циклов (на test mock-LINEA)
- [ ] ≥ 5 processTokenTwap циклов
- [ ] Bot avg profit > 0.02 ETH/цикл (даже на тестовых данных)
- [ ] Frontend работает с RainbowKit + Keycard, ты успешно подписал минимум 3 разные tx (buy, sell, processTokenTwap)
- [ ] Discord webhook alerts работают (тестовый pause Bot A → Bot B берёт нагрузку)

## Phase 4 — Linea mainnet deploy (production)

⚠️ **Эта фаза необратима. Все pre-flight checks ОБЯЗАТЕЛЬНЫ.**

### 4.1 Pre-flight checks

- [ ] Phase 3 acceptance criteria 100%
- [ ] [`50-lineastr-spec.md`](50-lineastr-spec.md) review tобой повторно
- [ ] Slither + Aderyn 0 findings
- [ ] Bot capital 3 ETH собран на твоём кошельке, готов к раздаче на Bot A/B
- [ ] `lineastrategy.com` куплен и DNS указывает на Vercel

### 4.2 Hook mining

```bash
cd contracts/
forge script script/MineHook.s.sol --rpc-url https://rpc.linea.build
# выводит salt + predicted hookAddress
# запоминаем для deploy
```

### 4.3 Deploy sequence

```bash
# 1. Deploy implementation contracts (BaseStrategy logic + Hook + Factory)
forge script script/DeployImplementations.s.sol \
  --rpc-url https://rpc.linea.build \
  --broadcast \
  --verify \
  --etherscan-api-key $LINEASCAN_API_KEY \
  --private-key $DEPLOYER_PK

# 2. Deploy Factory + Hook (CREATE2 with salt from 4.2)
forge script script/DeployFactory.s.sol \
  --rpc-url https://rpc.linea.build \
  --broadcast \
  --verify

# 3. Deploy LINEASTR proxy via Factory
forge script script/DeployLINEASTR.s.sol \
  --rpc-url https://rpc.linea.build \
  --broadcast \
  --verify
# this script:
#   - calls factory.deployStrategy(LINEA, 150_000e18, hookAddress, "LineaStrategy", "LINEASTR", 0.02e18, ownerKeycard)
#   - sets feeAddressClaimedByOwner[LINEASTR_PROXY] = 0x6e0d01089976093680c881CcDcB79e0D046e2433
#   - sets twapIncrement = 0.05e18
#   - sets twapDelayInBlocks = 4
#   - initializes Uniswap v4 pool with calibrated sqrtPriceX96
#   - seeds liquidity (1B LINEASTR single-sided)
#   - sends LP-NFT to 0xdead

# 4. Bot up
cd ../bot
fly deploy --app lineastr-bot-a
fly deploy --app lineastr-bot-b

# 5. Frontend up
cd ../frontend
vercel --prod
```

### 4.4 Post-launch monitoring (первые 24 часа)

- [ ] Discord webhook live, на каждый cycle / processTokenTwap / alert
- [ ] Etherscan/Lineascan watcher на `LINEASTR_PROXY` events
- [ ] Каждый час check `currentFees`, `ethToTwap`, `lastBuyBlock` через RPC
- [ ] Bot A/B health через fly.io dashboard
- [ ] Если что-то не так в первые 24 часа — у тебя есть owner privileges, fixes возможны через `updateHookAddress` или UUPS upgrade

### 4.5 Post-launch growth (неделя 1-4)

- День 1-7: collect baseline metrics (volume, cycles, burn-rate, treasury growth)
- День 7: первый retrospective — нужно ли поднять `twapIncrement` (если ETH-side пула > 5 ETH)?
- День 14: проверка bot capital — растёт ли? Если нет — анализ почему
- День 30: если всё стабильно — публичный report на X/Discord, привлечение audit (если ROI оправдан)

## Phase 5 — Расширение (опционально, после Phase 4 success)

После того, как $LINEASTR работает стабильно ≥ 30 дней:
- Запуск второго токена `$XYZSTR` где underlying = $XYZ (другой токен на Linea), используя ту же factory
- На втором токене fee split = 80% / 10% LINEASTR-burn / 10% creator (нормальный режим)
- Каждый новый токен → новые покупки $LINEASTR через `buy-and-burn` block → больше дефляции LINEASTR
- Это и есть «база для следующих токенов на Linea» из твоего изначального запроса

## Rollback / emergency procedures

### Если найден критичный баг в первые 24 часа

1. Owner вызывает `transferOwnership` на multisig (если уже есть) или paused-pattern (если успели добавить)
2. UUPS upgrade implementation: `proxy.upgradeToAndCall(NEW_IMPL, "")` — заменяем на patched implementation
3. Public statement в Discord/X — что нашли, что фиксим, никаких тихих фиксов

### Если бот A и B одновременно упали

1. Discord alert через 10 минут downtime
2. Ты вручную вызываешь `buyTokens()` через любой кошелёк (Keycard через MetaMask UI на Lineascan) — это аналог frontend-кнопки «Buy Target $LINEA»
3. Я в течение часа поднимаю боты обратно

### Если frontend упал

Vercel free tier обычно 99.9%+ uptime. Если down — у тебя есть:
- Прямой вызов через Lineascan UI (verified contracts → Write Contract → buyTokens / sellTokens / processTokenTwap)
- Backup статический Cloudflare Pages mirror на старом коммите
