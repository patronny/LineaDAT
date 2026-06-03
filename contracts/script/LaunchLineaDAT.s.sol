// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {LineaDATStrategy} from "../src/LineaDATStrategy.sol";
import {LineaDATFactory} from "../src/LineaDATFactory.sol";
import {LineaDATHook} from "../src/LineaDATHook.sol";
import {LineaDATBot} from "../src/LineaDATBot.sol";
import {LineaDATSeeder} from "../src/LineaDATSeeder.sol";
import {LineaDATTestSwapper} from "../src/LineaDATTestSwapper.sol";
import {ILineaDATFactory} from "../src/Interfaces.sol";

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

interface IERC20 {
    function transfer(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

/// @notice Atomic Phase 3.5 launch on Base Sepolia, modeled on TokenWorks WBTCSTR launch tx
///         (etherscan 0xd444a9db...). Single forge-script run deploys hook+factory+impl+strategy
///         +bot+swapper, initializes pool, seeds 1B LineaDAT single-sided, locks LP in seeder.
///
/// Pre-computes future addresses so the CREATE2-mined hook can hardcode the (not-yet-existing)
/// strategy proxy address as its immutable lineaDATAddress.
///
/// Initial currentFees seed (0.05 ETH) is intentionally SKIPPED - addFees is hook-only and there
/// is no admin path. The first swap from LineaDATTestSwapper after launch will accumulate fees
/// naturally via the hook.
contract LaunchLineaDAT is Script {
    /* === Base Sepolia constants === */
    address constant POOL_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
    address constant UNIVERSAL_ROUTER = 0x492E6456D9528771018DeB9E87ef7750EF184104;
    address constant TLINEA = 0x88a8D5ED5D1be44098F226EDf11C3160Fd76421F; // existing testnet $LINEA stub - DO NOT redeploy
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    /* === Locked LineaDAT params (per docs/50-lineadat-spec.md) === */
    uint256 constant BAG_SIZE = 150_000 * 1e18;
    uint256 constant BUY_INCREMENT = 0.02 ether;
    uint256 constant TWAP_INCREMENT = 0.05 ether;
    uint256 constant TWAP_DELAY_BLOCKS = 4;
    uint256 constant TOTAL_SUPPLY = 1_000_000_000 * 1e18; // 1B
    uint256 constant BOT_INITIAL_TLINEA = 1_500_000 * 1e18;

    /* === Pool config === */
    int24 constant TICK_LOWER = -887220;
    int24 constant TICK_UPPER = 175020; // ~ 1 ETH ~ 40M LineaDAT (FDV $100k @ ETH=$4000, see spec sec 4)
    int24 constant TICK_SPACING = 60;
    uint24 constant DYNAMIC_FEE_FLAG = 0x800000;

    /* === Hook permission flags === */
    uint160 constant REQUIRED_FLAGS = 0x2444; // BEFORE_INITIALIZE | AFTER_ADD_LIQUIDITY | AFTER_SWAP | AFTER_SWAP_RETURNS_DELTA
    uint256 constant MAX_SALT = 200_000;

    function run() external {
        require(block.chainid == 84532, "Must be on Base Sepolia (chainId 84532)");

        address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
        uint64 currentNonce = vm.getNonce(deployer);

        // FEE_ADDRESS = recipient of full 20% creator share on the LineaDAT self-launch.
        //   - feeds hook.feeAddress (10% LineaDAT-burn redirect; constructor arg)
        //   - feeds hook.feeAddressClaimedByOwner[proxy] (10% creator share; admin call post-deploy)
        // On testnet env is unset -> defaults to deployer EOA (one wallet collects both streams).
        // On mainnet pass FEE_ADDRESS=0x6e0d01089976093680c881CcDcB79e0D046e2433 to route to creator.
        address creatorFeeAddr = vm.envOr("FEE_ADDRESS", deployer);

        console.log("=== Atomic LineaDAT Phase 3.5 Launch ===");
        console.log("Deployer:        ", deployer);
        console.log("Deployer nonce:  ", currentNonce);
        console.log("Creator fee addr:", creatorFeeAddr);

        /* === Pre-compute deterministic addresses === */
        // Broadcast order from deployer EOA:
        //   tx N+0: call CREATE2_DEPLOYER (deploys hook). Every EOA tx consumes the deployer nonce.
        //   tx N+1: new LineaDATStrategy()  -> impl  at deployer nonce N+1
        //   tx N+2: new LineaDATFactory()   -> factory at deployer nonce N+2
        //   factory then CREATEs the strategy proxy at factory.nonce = 1
        address futureImpl    = vm.computeCreateAddress(deployer, currentNonce + 1);
        address futureFactory = vm.computeCreateAddress(deployer, currentNonce + 2);
        address futureProxy   = vm.computeCreateAddress(futureFactory, 1);

        console.log("Future impl:     ", futureImpl);
        console.log("Future factory:  ", futureFactory);
        console.log("Future proxy:    ", futureProxy);

        /* === Mine hook salt against pre-computed proxy === */
        bytes memory hookInitCode = abi.encodePacked(
            type(LineaDATHook).creationCode,
            abi.encode(IPoolManager(POOL_MANAGER), futureProxy, ILineaDATFactory(futureFactory), creatorFeeAddr)
        );
        bytes32 codeHash = keccak256(hookInitCode);

        bytes32 salt = bytes32(0);
        address hookAddr;
        for (uint256 i = 0; i < MAX_SALT; i++) {
            bytes32 trySalt = bytes32(i);
            address predicted = address(
                uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), CREATE2_DEPLOYER, trySalt, codeHash))))
            );
            if ((uint160(predicted) & 0x3FFF) == REQUIRED_FLAGS) {
                salt = trySalt;
                hookAddr = predicted;
                console.log("Hook salt mined: ", uint256(trySalt));
                console.log("Hook address:    ", hookAddr);
                break;
            }
        }
        require(hookAddr != address(0), "Hook mining failed; bump MAX_SALT");

        /* === Begin broadcast === */
        vm.startBroadcast();

        // 1. Deploy hook via CREATE2 first
        bytes memory deployData = abi.encodePacked(salt, hookInitCode);
        (bool ok, ) = CREATE2_DEPLOYER.call(deployData);
        require(ok, "CREATE2 deploy call failed");
        require(hookAddr.code.length > 0, "Hook deploy failed: no code at predicted addr");
        console.log("[1] Hook deployed via CREATE2 at:", hookAddr);

        // 2. Deploy strategy implementation (consumes deployer nonce)
        LineaDATStrategy impl = new LineaDATStrategy();
        require(address(impl) == futureImpl, "Impl address mismatch");
        console.log("[2] LineaDATStrategy impl:        ", address(impl));

        // 3. Deploy factory (consumes deployer nonce)
        LineaDATFactory factory = new LineaDATFactory(IPoolManager(POOL_MANAGER), UNIVERSAL_ROUTER);
        require(address(factory) == futureFactory, "Factory address mismatch");
        console.log("[3] LineaDATFactory:              ", address(factory));

        // 4. Configure factory (impl + hook set BEFORE pool init)
        factory.setStrategyImplementation(address(impl));
        factory.updateHookAddress(hookAddr);
        console.log("[4] Factory configured: impl + hook set");

        // 4b. Optionally set scheduledLaunchTime BEFORE pool init so deploymentTime[token]
        //     gets the future timestamp, not block.timestamp. Reads SCHEDULED_LAUNCH_TIME env;
        //     0 = launch immediately (no delay).
        uint256 launchTs = vm.envOr("SCHEDULED_LAUNCH_TIME", uint256(0));
        if (launchTs != 0) {
            require(launchTs > block.timestamp, "SCHEDULED_LAUNCH_TIME must be future");
            LineaDATHook(payable(hookAddr)).setScheduledLaunchTime(launchTs);
            console.log("[4b] scheduledLaunchTime set to:  ", launchTs);
            console.log("     (delta from now, seconds):  ", launchTs - block.timestamp);
        } else {
            console.log("[4b] No SCHEDULED_LAUNCH_TIME env -> trading opens immediately at pool init");
        }

        // 5. Deploy strategy proxy (factory's first CREATE -> predicted as futureProxy)
        address proxyAddr = factory.deployStrategy(
            TLINEA, BAG_SIZE, "LineaDAT", "LINEADAT", deployer, BUY_INCREMENT
        );
        require(proxyAddr == futureProxy, "Proxy address mismatch - hook will be wrong");
        LineaDATStrategy strategy = LineaDATStrategy(payable(proxyAddr));
        console.log("[5] LineaDATStrategy proxy:       ", proxyAddr);
        console.log("    name:                          ", strategy.name());
        console.log("    symbol:                        ", strategy.symbol());

        // 6. Owner-side TWAP setup (deployer is owner, so this just works)
        strategy.setTwapIncrement(TWAP_INCREMENT);
        strategy.setTwapDelayInBlocks(TWAP_DELAY_BLOCKS);
        console.log("[6] TWAP configured: increment=0.05 ETH, delay=4 blocks");

        // 6b. Claim 10% creator share via feeAddressClaimedByOwner[proxy]. Without this step the
        //     ownerAmount silently merges into treasury (see docs/50-lineadat-spec.md sec 3).
        //     Combined with hook.feeAddress (set in constructor, 10% LineaDAT-burn redirect on
        //     self-launch) this gives the spec-required 80/20 split = 2% of swap volume to creator.
        LineaDATHook(payable(hookAddr)).adminUpdateFeeAddress(proxyAddr, creatorFeeAddr);
        console.log("[6b] feeAddressClaimedByOwner[proxy] -> ", creatorFeeAddr);

        // 7. Deploy seeder
        LineaDATSeeder seeder = new LineaDATSeeder(IPoolManager(POOL_MANAGER));
        console.log("[7] LineaDATSeeder:               ", address(seeder));

        // 8. Move 1B LineaDAT from factory to seeder (factoryEscape is owner-only on strategy)
        strategy.factoryEscape(address(seeder), TOTAL_SUPPLY);
        console.log("[8] factoryEscape -> seeder. seeder LineaDAT bal:", strategy.balanceOf(address(seeder)));

        // 9. Set loadingLiquidity flag so hook lets the seed pass
        factory.setLoadingLiquidity(true);

        // 10. Initialize pool + add single-sided LP
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(proxyAddr),
            fee: DYNAMIC_FEE_FLAG,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(hookAddr)
        });
        uint160 sqrtPriceX96 = TickMath.getSqrtPriceAtTick(TICK_UPPER);
        uint160 sqrtPa = TickMath.getSqrtPriceAtTick(TICK_LOWER);
        uint160 sqrtPb = TickMath.getSqrtPriceAtTick(TICK_UPPER);
        // amount1 = L * (sqrtPb - sqrtPa) / 2^96, solving for L given amount1 = TOTAL_SUPPLY
        uint256 liquidity = (TOTAL_SUPPLY * (1 << 96)) / (sqrtPb - sqrtPa);
        require(liquidity <= type(uint128).max, "liquidity overflow uint128");
        console.log("[10] Pool sqrtPriceX96:           ", sqrtPriceX96);
        console.log("     Liquidity L:                 ", liquidity);

        seeder.seedAndLock(key, sqrtPriceX96, TICK_LOWER, TICK_UPPER, int256(liquidity));
        console.log("[10] Pool initialized, liquidity locked permanently in seeder");

        // 11. Unset loadingLiquidity
        factory.setLoadingLiquidity(false);

        // 12. Deploy bot
        LineaDATBot bot = new LineaDATBot(proxyAddr, TLINEA, deployer, deployer);
        strategy.setDistributor(address(bot), true);
        console.log("[12] LineaDATBot:                 ", address(bot));

        // 13. Deploy test swapper (so frontend Buy/Sell can drive fees)
        LineaDATTestSwapper swapper = new LineaDATTestSwapper(IPoolManager(POOL_MANAGER));
        console.log("[13] LineaDATTestSwapper:         ", address(swapper));

        // 14. Fund bot: transfer all available tLINEA + ETH from deployer EOA
        // tLINEA: deployer holds 2.6M (per current state); send 1.5M to bot, keep rest as reserve
        IERC20(TLINEA).transfer(address(bot), BOT_INITIAL_TLINEA);
        console.log("[14a] Bot funded with 1.5M tLINEA");

        // ETH: send 0.6 ETH to bot. Skip if balance insufficient (gas reserve).
        uint256 botEthFunding = 0.6 ether;
        if (deployer.balance >= botEthFunding + 0.05 ether) {
            payable(address(bot)).transfer(botEthFunding);
            console.log("[14b] Bot funded with 0.6 ETH");
        } else {
            console.log("[14b] SKIP ETH bot funding - insufficient deployer balance after gas");
        }

        vm.stopBroadcast();

        /* === Final summary === */
        console.log("");
        console.log("================================================");
        console.log("=== LineaDAT Phase 3.5 LAUNCH COMPLETE       ===");
        console.log("================================================");
        console.log("ChainId:               84532 (Base Sepolia)");
        console.log("tLINEA (existing):    ", TLINEA);
        console.log("LineaDATStrategy impl:", address(impl));
        console.log("LineaDATFactory:      ", address(factory));
        console.log("LineaDATHook:         ", hookAddr);
        console.log("LineaDAT proxy:       ", proxyAddr);
        console.log("LineaDATSeeder:       ", address(seeder));
        console.log("LineaDATBot:          ", address(bot));
        console.log("LineaDATTestSwapper:  ", address(swapper));
        console.log("Owner / Keeper:       ", deployer);
        console.log("================================================");
    }
}
