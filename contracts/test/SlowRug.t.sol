// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseTest} from "./Base.t.sol";

/// @notice Slow-rug attack vector: a lone bot waits for `currentFees` to grow large, then ramps
///         `getMaxPriceForBuy` over many blocks until potential bot profit (= currentFees - marketPrice(bagSize))
///         exceeds rational arbitrage thresholds. We verify here that:
///         (a) availableFunds is bounded by `min(currentFees, getMaxPriceForBuy)` - never exceeds either
///         (b) lastBuyBlock resets on every buyTokens, preventing the ceiling from staying high
///         (c) buyIncrement = 0.02 ETH/block on Linea makes catch-up to bagSize=0.236 ETH happen in ~12 blocks (~36s)
contract SlowRugTest is BaseTest {
    function test_getMaxPriceForBuy_isLinearInBlocks() public {
        uint256 base = strategy.lastBuyBlock();

        // 0 blocks elapsed → (0+1)*0.02 = 0.02 ETH
        assertEq(strategy.getMaxPriceForBuy(), 0.02 ether);

        vm.roll(base + 1);
        assertEq(strategy.getMaxPriceForBuy(), 0.04 ether);

        vm.roll(base + 5);
        assertEq(strategy.getMaxPriceForBuy(), 0.12 ether); // 6 * 0.02

        vm.roll(base + 50);
        assertEq(strategy.getMaxPriceForBuy(), 1.02 ether); // 51 * 0.02
    }

    function test_availableFunds_capsAtCurrentFees() public {
        _addFees(0.5 ether);
        // Roll many blocks so getMaxPriceForBuy >> currentFees
        vm.roll(block.number + 100);
        assertGt(strategy.getMaxPriceForBuy(), 0.5 ether);
        assertEq(strategy.availableFunds(), 0.5 ether, "capped at currentFees, not at potential ceiling");
    }

    function test_availableFunds_capsAtMaxPrice() public {
        _addFees(10 ether);
        // Only 1 block elapsed → maxPrice = 0.04 ETH (much less than currentFees)
        vm.roll(block.number + 1);
        assertEq(strategy.availableFunds(), 0.04 ether, "capped at getMaxPriceForBuy, not currentFees");
    }

    function test_lastBuyBlockResetsCeilingToOneIncrement() public {
        _addFees(1 ether);
        _approveLINEA(botA, 5 * BAG_SIZE);
        vm.roll(block.number + 50);

        uint256 firstFunds = strategy.availableFunds();
        vm.prank(botA);
        strategy.buyTokens();

        // Right after - getMaxPriceForBuy = 1 * 0.02 = 0.02 ETH (ceiling reset)
        assertEq(strategy.getMaxPriceForBuy(), 0.02 ether);
        // availableFunds = min(currentFees, getMaxPriceForBuy). After full draw, currentFees = 0,
        // so availableFunds = 0 (the harder bound).
        assertEq(strategy.availableFunds(), 0, "currentFees fully drained, availableFunds = 0");

        // First bag took up to currentFees => less remaining
        assertLt(strategy.currentFees(), 1 ether - firstFunds + 1);
    }

    /// @notice Anti-slow-rug: even with a lone bot waiting many blocks, it cannot grab MORE than currentFees in one buy.
    ///         This is the exact invariant violated in NFTStrategy gen-2 (low buyIncrement made currentFees outpace ceiling).
    function test_invariant_loneBotCannotGrabMoreThanCurrentFees(uint256 feesAmount) public {
        feesAmount = bound(feesAmount, 0.01 ether, 100 ether);
        _addFees(feesAmount);
        _approveLINEA(botA, BAG_SIZE);

        // Bot waits a LONG time
        vm.roll(block.number + 10_000);

        uint256 botEthBefore = botA.balance;
        vm.prank(botA);
        strategy.buyTokens();

        uint256 received = botA.balance - botEthBefore;
        // Bot got exactly currentFees (or less if maxPrice was lower, but with 10k blocks maxPrice = 200 ETH ≫ feesAmount)
        assertLe(received, feesAmount, "bot can never receive more than treasury holds");
    }

    function test_catchUpTime_onLineaParameters() public {
        _addFees(10 ether);

        // Goal: at what block count does getMaxPriceForBuy reach ~0.236 ETH (the bagSize ETH-equivalent)?
        // (N+1) * 0.02 = 0.236  →  N = 10.8 → ~12 blocks at Linea ~3s = 36 seconds
        vm.roll(block.number + 12);
        uint256 ceiling = strategy.getMaxPriceForBuy();
        assertGe(ceiling, 0.24 ether, "12 blocks => ceiling crosses bagSize ETH-equivalent");
        assertLt(ceiling, 0.28 ether, "12 blocks => ceiling not yet drastically over");
    }
}
