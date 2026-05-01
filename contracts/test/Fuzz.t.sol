// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseTest} from "./Base.t.sol";

/// @notice Fuzz tests for property invariants. Multiplies coverage via 256-run randomized inputs.
contract FuzzTest is BaseTest {
    /// @notice Property: availableFunds is always min(currentFees, getMaxPriceForBuy)
    function testFuzz_availableFundsInvariant(uint256 fees, uint256 blockSkip) public {
        fees = bound(fees, 0, 100 ether);
        blockSkip = bound(blockSkip, 0, 10_000);

        if (fees > 0) _addFees(fees);
        vm.roll(block.number + blockSkip);

        uint256 cf = strategy.currentFees();
        uint256 mb = strategy.getMaxPriceForBuy();
        uint256 af = strategy.availableFunds();

        assertEq(af, cf < mb ? cf : mb, "availableFunds = min(currentFees, getMaxPriceForBuy)");
    }

    /// @notice Property: getMaxPriceForBuy is monotonic non-decreasing across blocks (without buyTokens)
    function testFuzz_maxPriceMonotonicInBlocks(uint256 b1, uint256 b2) public {
        b1 = bound(b1, 0, 1_000_000);
        b2 = bound(b2, b1, 1_000_000);

        vm.roll(block.number + b1);
        uint256 m1 = strategy.getMaxPriceForBuy();
        vm.roll(block.number + (b2 - b1));
        uint256 m2 = strategy.getMaxPriceForBuy();
        assertGe(m2, m1, "non-decreasing");
    }

    /// @notice Property: addFees is purely additive (commutative on currentFees)
    function testFuzz_addFeesAdditive(uint256 a, uint256 b) public {
        a = bound(a, 0, 50 ether);
        b = bound(b, 0, 50 ether);
        _addFees(a);
        _addFees(b);
        assertEq(strategy.currentFees(), a + b);
    }

    /// @notice Property: priceMultiplier is bounded after setPriceMultiplier
    function testFuzz_priceMultiplierBounded(uint256 m) public {
        m = bound(m, 1, 20_000);

        vm.prank(address(factory));
        if (m < 1100 || m > 10000) {
            vm.expectRevert();
            strategy.setPriceMultiplier(m);
        } else {
            strategy.setPriceMultiplier(m);
            assertEq(strategy.priceMultiplier(), m);
        }
    }

    /// @notice Property: list price = paid * priceMultiplier / 1000
    function testFuzz_listPriceFormula(uint256 fees, uint256 blockSkip) public {
        fees = bound(fees, 0.01 ether, 10 ether);
        blockSkip = bound(blockSkip, 1, 1000);

        _addFees(fees);
        _approveLINEA(botA, BAG_SIZE);
        vm.roll(block.number + blockSkip);

        uint256 paid = strategy.availableFunds();
        if (paid == 0) return; // skip if no funds

        vm.prank(botA);
        strategy.buyTokens();

        uint256 listPrice = strategy.onSale(strategy.lastBagId());
        uint256 expectedListPrice = paid * 1200 / 1000; // 1.2x markup
        assertEq(listPrice, expectedListPrice, "listPrice = paid * 1.2");
    }

    /// @notice Property: a sell-cycle of bag exactly transfers BAG_SIZE LINEA to buyer and listPrice ETH to ethToTwap
    function testFuzz_sellCycleConservation(uint256 fees, uint256 blockSkip) public {
        fees = bound(fees, 0.05 ether, 10 ether);
        blockSkip = bound(blockSkip, 5, 500);

        _addFees(fees);
        _approveLINEA(botA, BAG_SIZE);
        vm.roll(block.number + blockSkip);

        uint256 strategyLineaBefore = linea.balanceOf(address(strategy));
        uint256 ethToTwapBefore = strategy.ethToTwap();

        vm.prank(botA);
        strategy.buyTokens();

        uint256 listPrice = strategy.onSale(strategy.lastBagId());

        vm.prank(buyer);
        strategy.sellTokens{value: listPrice}(strategy.lastBagId());

        // After full cycle: strategy LINEA balance is unchanged (gained from bot, lost to buyer)
        assertEq(linea.balanceOf(address(strategy)), strategyLineaBefore, "LINEA balance round-trips");
        assertEq(strategy.ethToTwap(), ethToTwapBefore + listPrice, "ethToTwap += listPrice");
    }

    /// @notice Property: setTwapIncrement and setTwapDelayInBlocks accept any uint256 (no bounds enforced)
    function testFuzz_setTwapIncrement(uint256 inc) public {
        vm.prank(owner);
        strategy.setTwapIncrement(inc);
        assertEq(strategy.twapIncrement(), inc);
    }

    function testFuzz_setTwapDelayInBlocks(uint256 d) public {
        vm.prank(owner);
        strategy.setTwapDelayInBlocks(d);
        assertEq(strategy.twapDelayInBlocks(), d);
    }

    /// @notice Property: ownerOnly setters revert for any non-owner address
    function testFuzz_setTwapIncrement_nonOwnerReverts(address attacker) public {
        vm.assume(attacker != owner && attacker != address(0));
        vm.prank(attacker);
        vm.expectRevert();
        strategy.setTwapIncrement(0.5 ether);
    }

    function testFuzz_updateBagSize_nonOwnerReverts(address attacker, uint256 newSize) public {
        vm.assume(attacker != owner && attacker != address(0));
        newSize = bound(newSize, 1, 1e30);
        vm.prank(attacker);
        vm.expectRevert();
        strategy.updateBagSize(newSize);
    }

    /// @notice Property: factoryOnly setter (setPriceMultiplier) reverts for any non-factory address
    function testFuzz_setPriceMultiplier_nonFactoryReverts(address attacker) public {
        vm.assume(attacker != address(factory));
        vm.prank(attacker);
        vm.expectRevert();
        strategy.setPriceMultiplier(1500);
    }

    /// @notice Property: hookOnly addFees reverts for any non-hook address
    function testFuzz_addFees_nonHookReverts(address attacker, uint256 amt) public {
        vm.assume(attacker != address(this)); // address(this) IS the hook in BaseTest
        vm.assume(attacker != address(0));
        amt = bound(amt, 1, 100 ether);
        vm.deal(attacker, amt);
        vm.prank(attacker);
        vm.expectRevert();
        strategy.addFees{value: amt}();
    }

    /// @notice Property: After buyTokens, bagId always increments by 1
    function testFuzz_bagIdMonotonic(uint256 cycles) public {
        cycles = bound(cycles, 1, 5);
        _approveLINEA(botA, cycles * BAG_SIZE);

        for (uint256 i = 0; i < cycles; i++) {
            _addFees(0.5 ether);
            vm.roll(block.number + 30);
            vm.prank(botA);
            strategy.buyTokens();
            assertEq(strategy.lastBagId(), i + 1, "bagId increments by 1");
        }
    }
}
