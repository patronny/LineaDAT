// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";

/// @notice Linea-mainnet fork check for the frontend's slippage protection (lib/v4-swap.ts).
///         Proves the v4 Quoter's output equals what an actual Universal Router swap delivers
///         (so amountOutMinimum = quote x 98% never false-reverts), and that the floor bites when
///         set above the achievable output. Mirrors the exact V4_SWAP command/action/param encoding
///         the frontend builds. Run:
///           forge test --match-path test/ForkQuoterSlippage.t.sol --fork-url https://rpc.linea.build -vv
interface IUniversalRouter {
    function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable;
}

interface IV4Quoter {
    struct QuoteExactSingleParams {
        PoolKey poolKey;
        bool zeroForOne;
        uint128 exactAmount;
        bytes hookData;
    }

    function quoteExactInputSingle(QuoteExactSingleParams calldata params)
        external
        returns (uint256 amountOut, uint256 gasEstimate);
}

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
}

interface IPermit2 {
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;
}

contract ForkQuoterSlippageTest is Test {
    // Linea mainnet canonical infra
    address constant UR = 0x8B844f885672f333Bc0042cB669255f93a4C1E6b;
    address constant QUOTER = 0x2C125569C0BeE20A66E33E5491C552B37EBD9934;
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    // LINEADAT deployment
    address constant TOKEN = 0x02F289E429655d0C0D713A7dFD26850A81f7cFC5; // strategy proxy = currency1
    address constant HOOK = 0xA0FAD88E899D7a70179A473140111AB4016F6444;

    // deploymentTime[TOKEN] = scheduled launch gate (June 9 2026 16:00 UTC); warp past it to trade.
    uint256 constant LAUNCH_TS = 1781020800;
    // Mirror frontend SLIPPAGE_BPS (lib/v4-swap.ts).
    uint256 constant SLIPPAGE_BPS = 200;

    // Universal Router command + v4 router action ids (mirror lib/v4-swap.ts).
    uint8 constant SWAP_EXACT_IN_SINGLE = 0x06;
    uint8 constant SETTLE_ALL = 0x0c;
    uint8 constant TAKE_ALL = 0x0f;
    uint8 constant V4_SWAP = 0x10;

    struct ExactInputSingleParams {
        PoolKey poolKey;
        bool zeroForOne;
        uint128 amountIn;
        uint128 amountOutMinimum;
        bytes hookData;
    }

    address user = address(0xBEEF);

    function setUp() public {
        // Fork-only: in the offline baseline suite (no --fork-url) the Linea contracts aren't
        // present, so skip cleanly instead of failing. Run with --fork-url to exercise.
        if (TOKEN.code.length == 0) {
            vm.skip(true);
            return;
        }
        // Past the launch gate so swaps/quotes are allowed; far enough that the anti-snipe fee has
        // decayed to a realistic level (irrelevant to quote==actual, but keeps amounts non-dust).
        vm.warp(LAUNCH_TS + 2 days);
        vm.deal(user, 10 ether);
    }

    function poolKey() internal pure returns (PoolKey memory) {
        return PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(TOKEN),
            fee: 0x800000, // DYNAMIC_FEE_FLAG
            tickSpacing: 60,
            hooks: IHooks(HOOK)
        });
    }

    function applySlippage(uint256 amountOut) internal pure returns (uint128) {
        return uint128(amountOut * (10_000 - SLIPPAGE_BPS) / 10_000);
    }

    /// Mirror encodeV4Swap() from the frontend, byte-for-byte.
    function buildSwap(bool zeroForOne, uint128 amountIn, uint128 minOut)
        internal
        pure
        returns (bytes memory commands, bytes[] memory inputs)
    {
        address inputCurrency = zeroForOne ? address(0) : TOKEN;
        address outputCurrency = zeroForOne ? TOKEN : address(0);

        bytes memory actions = abi.encodePacked(SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL);

        ExactInputSingleParams memory sp = ExactInputSingleParams({
            poolKey: poolKey(),
            zeroForOne: zeroForOne,
            amountIn: amountIn,
            amountOutMinimum: minOut,
            hookData: ""
        });

        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(sp);
        params[1] = abi.encode(inputCurrency, uint256(amountIn)); // SETTLE_ALL
        params[2] = abi.encode(outputCurrency, uint256(minOut)); // TAKE_ALL

        inputs = new bytes[](1);
        inputs[0] = abi.encode(actions, params);
        commands = abi.encodePacked(V4_SWAP);
    }

    function quoteBuy(uint128 amountIn) internal returns (uint256 out) {
        (out,) = IV4Quoter(QUOTER).quoteExactInputSingle(
            IV4Quoter.QuoteExactSingleParams({
                poolKey: poolKey(),
                zeroForOne: true,
                exactAmount: amountIn,
                hookData: ""
            })
        );
    }

    /// Quote == actual delivered output, and the 2% floor is comfortably cleared (buy direction).
    function test_buy_quoteMatchesActual_andFloorHolds() public {
        uint128 amountIn = 0.05 ether;
        uint256 quoted = quoteBuy(amountIn);
        assertGt(quoted, 0, "quote must be > 0 once the gate is open");
        uint128 minOut = applySlippage(quoted);

        (bytes memory commands, bytes[] memory inputs) = buildSwap(true, amountIn, minOut);

        uint256 before = IERC20(TOKEN).balanceOf(user);
        vm.prank(user);
        IUniversalRouter(UR).execute{value: amountIn}(commands, inputs, block.timestamp + 1800);
        uint256 received = IERC20(TOKEN).balanceOf(user) - before;

        console.log("buy quoted  :", quoted);
        console.log("buy received:", received);
        console.log("buy minOut  :", minOut);

        assertEq(received, quoted, "actual buy output must equal the quote (same pre-swap state, fee in delta)");
        assertGe(received, minOut, "received must clear the 2% slippage floor");
    }

    /// A floor set above the achievable output reverts (proves the slippage guard actually bites).
    function test_buy_floorAboveQuote_reverts() public {
        uint128 amountIn = 0.05 ether;
        uint256 quoted = quoteBuy(amountIn);
        // 0.1% ABOVE the exact quote -> unreachable -> must revert.
        uint128 tooHigh = uint128(quoted + quoted / 1000 + 1);

        (bytes memory commands, bytes[] memory inputs) = buildSwap(true, amountIn, tooHigh);

        vm.prank(user);
        vm.expectRevert();
        IUniversalRouter(UR).execute{value: amountIn}(commands, inputs, block.timestamp + 1800);
    }

    /// Full round-trip: buy, then sell via Permit2 with a Quoter-derived floor (sell direction).
    function test_sell_quoteMatchesActual_andFloorHolds() public {
        // Acquire a position first.
        uint128 buyIn = 0.1 ether;
        uint256 buyQuote = quoteBuy(buyIn);
        (bytes memory bc, bytes[] memory bi) = buildSwap(true, buyIn, applySlippage(buyQuote));
        vm.prank(user);
        IUniversalRouter(UR).execute{value: buyIn}(bc, bi, block.timestamp + 1800);
        uint128 sellAmount = uint128(IERC20(TOKEN).balanceOf(user));
        assertGt(sellAmount, 0, "must hold tokens to sell");

        // Sell approvals: token -> Permit2, Permit2 -> Universal Router.
        vm.startPrank(user);
        IERC20(TOKEN).approve(PERMIT2, type(uint256).max);
        IPermit2(PERMIT2).approve(TOKEN, UR, type(uint160).max, type(uint48).max);
        vm.stopPrank();

        // Quote the sell from the post-buy state (Quoter reverts internally -> no state change).
        (uint256 sellQuote,) = IV4Quoter(QUOTER).quoteExactInputSingle(
            IV4Quoter.QuoteExactSingleParams({
                poolKey: poolKey(),
                zeroForOne: false,
                exactAmount: sellAmount,
                hookData: ""
            })
        );
        assertGt(sellQuote, 0, "sell quote must be > 0");
        uint128 sellMinOut = applySlippage(sellQuote);

        (bytes memory sc, bytes[] memory si) = buildSwap(false, sellAmount, sellMinOut);
        uint256 ethBefore = user.balance;
        vm.prank(user);
        IUniversalRouter(UR).execute(sc, si, block.timestamp + 1800);
        uint256 ethReceived = user.balance - ethBefore;

        console.log("sell quoted  :", sellQuote);
        console.log("sell received:", ethReceived);
        console.log("sell minOut  :", sellMinOut);

        assertEq(ethReceived, sellQuote, "actual sell output must equal the quote");
        assertGe(ethReceived, sellMinOut, "ETH received must clear the 2% slippage floor");
    }
}
