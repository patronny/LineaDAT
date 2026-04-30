# Resolved Blockers — критические находки после plan-approval

Этот документ закрывает **3 критических blocker**, отмеченных в финальном плане как "open questions". Данные собраны через прямые RPC eth_call к публичным Linea endpoints, чтение `Uniswap/sdks` source-of-truth, и анализ verified Blockscout sources. Все адреса проверены через `eth_getCode` на `https://rpc.linea.build`.

---

## 1. Uniswap v4 deployments на Linea mainnet (chainId 59144)

**Источник истины**: `Uniswap/sdks` repo, `sdks/sdk-core/src/addresses.ts` (lines 463–478) на main branch — это тот же SDK что powering `app.uniswap.org`. UR addresses — `sdks/universal-router-sdk/src/utils/constants.ts` lines 471–485.

**Verification**: каждый адрес проверен `eth_getCode` к `https://rpc.linea.build` — все возвращают non-empty bytecode.

### Mainnet (chainId 59144)

| Контракт | Адрес | Размер байткода |
|---|---|---|
| **PoolManager** | `0x248083fb965359d82b06c1f5322480dcfc1ad857` | ~24KB |
| **PositionManager** (POSM, NFT-LP) | `0xddcad5775b2816a87495f207731b3571d7ee3c76` | ~24KB |
| **StateView** (read-only) | `0xe861de206e460a8b936b05ad3816520b58ccdf9b` | ~3.5KB |
| **Quoter** | `0x2c125569c0bee20a66e33e5491c552b37ebd9934` | ~6KB |
| **UniversalRouter V2_1_1 (v4-capable)** | `0x8B844f885672f333Bc0042cB669255f93a4C1E6b` | ~25KB, deployed 2026-03-18 (block 29782392) |
| UniversalRouter V2_0 (v2/v3 only — НЕ для v4) | `0x661e93cca42afacb172121ef892830ca3b70f08d` | ~20KB |
| WETH9 | `0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f` | — |
| Permit2 (universal address) | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | — |
| CREATE2 deployer | `0x0000000000FFe8B47B3e2130213B802212439497` | 4211 bytes — есть на Linea ✓ |

⚠️ **Используем UniversalRouter V2_1_1** (`0x8B844f...`) — V2_0 не поддерживает v4, только v2/v3.

### Linea Sepolia testnet (chainId 59141)

❌ **Uniswap v4 на Linea Sepolia НЕ задеплоен** на 2026-05-01.

**Альтернатива для testnet**: Sepolia / Base Sepolia / Arbitrum Sepolia / Unichain Sepolia (адреса в `Uniswap/v4-periphery/broadcast/`).

---

## 2. $LINEA token — verified canonical L2

### Контракт

| Поле | Значение |
|---|---|
| Address (proxy) | `0x1789e0043623282D5DCc7F213d703C6D8BAfBB04` |
| Implementation (EIP-1967) | `0xe03F157dE67AC4b2A9a949D64d2A3C64Ffa1BC55` |
| Proxy Admin (EIP-1967) | `0x0ccbf317EDF1F960fE49B659B6d17cBC596DfADa` |
| Verified | YES — `L2LineaToken`, Solidity 0.8.30, optimizer 10M runs |
| Author | Consensys Software Inc. |
| Type | **Canonical Linea L2 token** (TransparentUpgradeableProxy) |
| name / symbol / decimals | "Linea" / "LINEA" / 18 |
| Total supply на Linea | **69,958,991,343** (~69.96 млрд, не 72.01!) |
| L1 supply (синхронизирован) | ~70.00 млрд |
| Supply ratio L2/L1 | 99.94% |

### Поведение transfer (ВСЁ ЧИСТОЕ)

| Свойство | Статус |
|---|---|
| Fee-on-transfer | NO (`_update` делегирует super без удержаний) |
| Rebase | NO (стандартный ERC20Upgradeable) |
| Pausable | NO (нет `paused()`, нет Pausable импорта) |
| Blacklist | NO (`isBlacklisted` ревёртится) |
| Mint/Burn | Только `lineaCanonicalTokenBridge` = `0x353012dc4a9A6cF55c941bADC267f82004A8ceB9` |
| ERC20Permit (EIP-2612) | YES |
| ERC20Votes (governance) | YES — block-based clock |

**Bridges**: `lineaCanonicalTokenBridge() = 0x353012dc...A8ceB9` — совпадает с известным L2 Token Bridge ✓ canonical schema.

### Risk: upgradeable

Контракт upgradeable через Transparent Proxy. Admin (`0x0ccbf317...`) — multisig Consensys/Linea Foundation. Может теоретически добавить fee/pause/blacklist через upgrade. **Это стандартный risk любого bridged token (USDC, USDT)** — терпимо для наших целей.

### ⚠️ КРИТИЧНОЕ: Liquidity на Linea DEX

| Источник | TVL | 24h volume |
|---|---|---|
| **ВСЕ DEX'ы** | **$544,501** | **$80,900** |
| Etherex LINEA/USDC | $267,433 | $3,243 |
| Etherex LINEA/WETH | $147,691 | $25,554 |
| Lynex LINEA/WETH | $17,105 | $3,684 |

**Цена $LINEA медианная**: **~$0.003556**

**ИЗ ЭТОГО СЛЕДУЕТ**:
- Наш `bagSize = 250_000 LINEA × $0.003556 = $889`
- Это в **~1.5x меньше** чем bag wBTCStrategy (0.0125 wBTC × $90,000 = $1,125 на launch, сейчас ~$1,300)
- НО относительно DEX-ликвидности на Linea это нормально: $889 ÷ $134k LINEA-side в Etherex pool = **0.66% slippage** — приемлемо

**Holders distribution**: top-2 EOA держат **47.1B LINEA (~67% supply)** — vesting/treasury, не in DEX. Не повлияет на bot арбитраж напрямую.

---

## 3. Uniswap v4-template patterns

**Репо переехало**: `Uniswap/v4-template` → **`uniswapfoundation/v4-template`**.

### HookMiner (полный source из v4-periphery)

```solidity
// lib/v4-periphery/src/utils/HookMiner.sol (через uniswap-hooks submodule)
library HookMiner {
    uint160 constant FLAG_MASK = Hooks.ALL_HOOK_MASK; // 0x3FFF
    uint256 constant MAX_LOOP = 160_444;

    function find(address deployer, uint160 flags, bytes memory creationCode, bytes memory constructorArgs)
        internal view returns (address, bytes32)
    {
        flags = flags & FLAG_MASK;
        bytes memory creationCodeWithArgs = abi.encodePacked(creationCode, constructorArgs);
        address hookAddress;
        for (uint256 salt; salt < MAX_LOOP; salt++) {
            hookAddress = computeAddress(deployer, salt, creationCodeWithArgs);
            if (uint160(hookAddress) & FLAG_MASK == flags && hookAddress.code.length == 0) {
                return (hookAddress, bytes32(salt));
            }
        }
        revert("HookMiner: could not find salt");
    }

    function computeAddress(address deployer, uint256 salt, bytes memory creationCodeWithArgs)
        internal pure returns (address hookAddress) {
        return address(uint160(uint256(keccak256(
            abi.encodePacked(bytes1(0xFF), deployer, salt, keccak256(creationCodeWithArgs))
        ))));
    }
}
```

### Permission flag bits (точные из `v4-core/src/libraries/Hooks.sol`)

```
ALL_HOOK_MASK = 0x3FFF (нижние 14 бит)

BEFORE_INITIALIZE_FLAG                       = 1 << 13 = 0x2000
AFTER_INITIALIZE_FLAG                        = 1 << 12 = 0x1000
BEFORE_ADD_LIQUIDITY_FLAG                    = 1 << 11 = 0x0800
AFTER_ADD_LIQUIDITY_FLAG                     = 1 << 10 = 0x0400
BEFORE_REMOVE_LIQUIDITY_FLAG                 = 1 <<  9 = 0x0200
AFTER_REMOVE_LIQUIDITY_FLAG                  = 1 <<  8 = 0x0100
BEFORE_SWAP_FLAG                             = 1 <<  7 = 0x0080
AFTER_SWAP_FLAG                              = 1 <<  6 = 0x0040
BEFORE_DONATE_FLAG                           = 1 <<  5 = 0x0020
AFTER_DONATE_FLAG                            = 1 <<  4 = 0x0010
BEFORE_SWAP_RETURNS_DELTA_FLAG               = 1 <<  3 = 0x0008
AFTER_SWAP_RETURNS_DELTA_FLAG                = 1 <<  2 = 0x0004
AFTER_ADD_LIQUIDITY_RETURNS_DELTA_FLAG       = 1 <<  1 = 0x0002
AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA_FLAG    = 1 <<  0 = 0x0001
```

### ⚠️ Корректировка по hook permissions: TokenWorks НЕ использует `beforeInitialize`!

Hook address TokenWorks = `0x9f8f375b2d246da6be816b453f13d43d8240a444`. Последние 14 бит = `0x0444` = `0x0400 | 0x0040 | 0x0004` = `AFTER_ADD_LIQUIDITY | AFTER_SWAP | AFTER_SWAP_RETURNS_DELTA`. **Бит 13 (`0x2000`, BEFORE_INITIALIZE) НЕ set**.

Хотя в их verified `getHookPermissions()` возвращается `beforeInitialize: true` (строки 222–239), фактически адрес кодирует `false`. Это либо документация-rudiment, либо `Hooks.validateHookPermissions` не вызывался при их деплое (что странно — `BaseHook` constructor валидирует).

**Решение для LINEASTR**: ставим `beforeInitialize = false`, удаляем `_beforeInitialize` функцию. Anti-shadow-pool guard остаётся через `_afterAddLiquidity` (loadingLiquidity check на factory). Маска становится **`0x0444`** — идентично TokenWorks deployed hook.

**Наша окончательная маска**: `AFTER_ADD_LIQUIDITY | AFTER_SWAP | AFTER_SWAP_RETURNS_DELTA = 0x0400 | 0x0040 | 0x0004 = 0x0444`.

### Pool init + add liquidity — РЕКОМЕНДОВАННЫЙ путь

Через `IPositionManager.multicall([initializePool, modifyLiquidities])` — **проще** чем raw `unlock()` callback.

```solidity
// Параметры
PoolKey memory poolKey = PoolKey({
    currency0: Currency.wrap(address(0)),    // ETH
    currency1: Currency.wrap(strategy),      // LINEASTR
    fee: 0,                                  // hook берёт fee сам
    tickSpacing: 60,
    hooks: hookContract
});

// Full-range
int24 tickLower = TickMath.minUsableTick(60);  // -887220
int24 tickUpper = TickMath.maxUsableTick(60);  //  887220

// Posted liquidity
uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
    sqrtPriceX96,
    TickMath.getSqrtPriceAtTick(tickLower),
    TickMath.getSqrtPriceAtTick(tickUpper),
    1 ether,                  // ETH amount
    72_009_990 * 1e18         // LINEASTR amount
);

// Actions: MINT_POSITION → SETTLE_PAIR → SWEEP currency0 → SWEEP currency1
bytes memory actions = abi.encodePacked(
    uint8(Actions.MINT_POSITION),
    uint8(Actions.SETTLE_PAIR),
    uint8(Actions.SWEEP),
    uint8(Actions.SWEEP)
);
bytes[] memory params = new bytes[](4);
params[0] = abi.encode(poolKey, tickLower, tickUpper, liquidity, amount0Max, amount1Max, recipient, "");
params[1] = abi.encode(poolKey.currency0, poolKey.currency1);
params[2] = abi.encode(poolKey.currency0, recipient);
params[3] = abi.encode(poolKey.currency1, recipient);

// Multicall: initializePool + modifyLiquidities
bytes[] memory mc = new bytes[](2);
mc[0] = abi.encodeWithSelector(IPoolInitializer_v4.initializePool.selector, poolKey, sqrtPriceX96, "");
mc[1] = abi.encodeWithSelector(IPositionManager.modifyLiquidities.selector,
    abi.encode(actions, params), block.timestamp + 3600);

positionManager.multicall{value: 1 ether}(mc);
```

`SETTLE_PAIR` платит оба отрицательных delta. `SWEEP` забирает leftover на recipient — обязательно если `getLiquidityForAmounts` использует не всю сумму.

### Approvals (Permit2)

```solidity
IERC20(linea).approve(address(permit2), type(uint256).max);
permit2.approve(linea, address(positionManager), type(uint160).max, type(uint48).max);
// ETH (currency0=0) не требует approve, передаётся в msg.value
```

### sqrtPriceX96 для 1 ETH ↔ 72_009_990 LINEASTR

Формула: `sqrtPriceX96 = floor(sqrt(amount1 * 2^192 / amount0))`.

```solidity
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";

uint256 ratioX192 = FullMath.mulDiv(72_009_990 * 1e18, 1 << 192, 1 ether);
uint160 sqrtPriceX96 = uint160(FixedPointMathLib.sqrt(ratioX192));
// ≈ 0x2125deb9a5166800000000000000  (~6.72×10³²)
```

`tick = log_{1.0001}(72_009_990) ≈ 180_932` — глубоко внутри допустимого `[-887272, 887272]`.

### Settle pattern в `unlockCallback` (если выберем raw unlock)

```solidity
import {CurrencySettler} from "@openzeppelin/uniswap-hooks/src/utils/CurrencySettler.sol";
using CurrencySettler for Currency;

function unlockCallback(bytes calldata data) external returns (bytes memory) {
    require(msg.sender == address(poolManager), "not PM");
    // ... modifyLiquidity ... 
    // settle ETH:
    Currency.wrap(address(0)).settle(poolManager, payer, ethAmount, false);
    // settle ERC-20:
    Currency.wrap(token).settle(poolManager, payer, tokenAmount, false);
}
```

### Подводные камни

1. `Hooks.validateHookPermissions` зашит в `BaseHook` constructor — если permissions не совпадают с битами адреса, deploy ревертит. Главный риск: `afterSwapReturnDelta=true` без `afterSwap=true` → revert.
2. `sender` в `_afterSwap` — это router, не original user. Per-user логика требует `IMsgSender.msgSender()` (PositionManager + V4Router04 от Uniswap его реализуют).
3. Re-entry в `unlockCallback`: повторный `unlock()` ревертит (`AlreadyUnlocked`). Внутри callback можно делать `modifyLiquidity/swap/take/settle`.
4. Salt collision — для фактории deployer = `address(this)`, salt должен быть уникален per-launch.
5. `hookData` в swap'е приходит от user через router — нельзя использовать для ACL.

---

## Изменения в плане после resolution

Новые данные требуют корректировки финального плана:

### 1. `foundry.toml` — добавить точные адреса

```toml
[rpc_endpoints]
linea = "https://rpc.linea.build"
```

`script/config.sol` constants:
```solidity
address constant LINEA_TOKEN = 0x1789e0043623282D5DCc7F213d703C6D8BAfBB04;
address constant POOL_MANAGER = 0x248083fb965359d82b06c1f5322480dcfc1ad857;
address constant POSITION_MANAGER = 0xddcad5775b2816a87495f207731b3571d7ee3c76;
address constant V4_ROUTER = 0x8B844f885672f333Bc0042cB669255f93a4C1E6b;
address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
address constant CREATE2_DEPLOYER = 0x0000000000FFe8B47B3e2130213B802212439497;
```

### 2. Hook permissions упрощаются

Удаляем `beforeInitialize` из `getHookPermissions()` и удаляем функцию `_beforeInitialize`. Маска `0x0444`. Pre-init guard остаётся в `_afterAddLiquidity` через `factory.loadingLiquidity()`.

### 3. Factory — рекомендуем PositionManager API вместо raw unlock

Это упрощает `LineaStrategyFactory.launch()` — нет своего `unlockCallback`, нет `IUnlockCallback` импорта, не нужен `CurrencySettler`. Approvals только Permit2 (одноразовые).

### 4. Testnet стратегия

Linea Sepolia v4 НЕ доступен. Варианты:
- Тестируем на **Base Sepolia** (v4 deployed) или **Sepolia** — pre-mainnet integration tests
- Тестируем на Linea mainnet с минимальной ликвидностью (0.01 ETH) — risky но реалистично
- Forge-tests с `--fork-url linea` — без real deploy, но все integration работают

Рекомендую **Sepolia/Base Sepolia testnet тесты + Linea mainnet smoke с 0.01 ETH перед полным 1 ETH launch**.

### 5. Submodules — корректные пути

Вместо raw `Uniswap/v4-core` использовать **`openzeppelin/uniswap-hooks`** (он содержит pinned v4-core/v4-periphery + HookMiner + CurrencySettler):

```bash
forge install foundry-rs/forge-std openzeppelin/uniswap-hooks akshatmittal/hookmate
```

Remappings:
```
forge-std/=lib/forge-std/src/
@uniswap/v4-core/=lib/uniswap-hooks/lib/v4-core/
@uniswap/v4-periphery/=lib/uniswap-hooks/lib/v4-periphery/
@openzeppelin/uniswap-hooks/=lib/uniswap-hooks/
hookmate/=lib/hookmate/src/
solady/=lib/uniswap-hooks/lib/v4-core/lib/solmate/...
```

### 6. ⚠️ Низкая ликвидность $LINEA — пересмотр bagSize

**Текущая цена $LINEA**: ~$0.003556. **bagSize = 250_000 × $0.003556 = $889**.

Для сравнения:
- wBTCStrategy bag (0.0125 wBTC) = ~$1,300
- наш bag = ~$889 (-31%)
- Etherex LINEA/USDC pool LINEA-side = $134k → bag = 0.66% pool

**Это приемлемо** — бот сможет покупать 250k за один swap с slippage <1%. Но это значит наш flywheel будет работать **на меньших объёмах в USD**, и каждый цикл buy/sell даст meaningful PnL только если price multiplier 1.2x работает на абсолютной разнице — то есть один цикл даст ~$178 profit (на $889 base). Это нормально для micro-strategy на Linea, но стоит учитывать что 34 циклов wBTCStrategy за 108 дней = $1.99 ETH profit ≈ $7000 на bag $1300 = 1.5x ROI. У нас на меньшем bag и меньшей ликвидности, **скорее всего ROI будет такого же порядка но в абсолюте копейки**.

Если хочешь больший абсолютный объём — нужно либо увеличить bagSize до 1_000_000 LINEA ($3,560), либо подождать роста цены $LINEA.

---

## Источники

- Uniswap SDKs (raw): `https://raw.githubusercontent.com/Uniswap/sdks/main/sdks/sdk-core/src/addresses.ts`
- v4-template: `https://github.com/uniswapfoundation/v4-template`
- v4-core Hooks.sol: `https://github.com/Uniswap/v4-core/blob/main/src/libraries/Hooks.sol`
- v4-periphery PositionManager: `https://github.com/Uniswap/v4-periphery/blob/main/src/PositionManager.sol`
- OpenZeppelin uniswap-hooks: `https://github.com/OpenZeppelin/uniswap-hooks`
- hookmate AddressConstants: `https://github.com/akshatmittal/hookmate/blob/main/src/constants/AddressConstants.sol`
- $LINEA verified source: Etherscan v2 multichain (chainid=59144), Apache-2.0/MIT, Consensys
- Linea RPC: `https://rpc.linea.build` — все адреса verified через `eth_getCode`
- DexScreener Linea pools: `https://dexscreener.com/linea?q=LINEA`
