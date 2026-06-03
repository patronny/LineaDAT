// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {LineaDATBot} from "../src/LineaDATBot.sol";

/// @notice Redeploys LineaDATBot on Base Sepolia with the patched _tryTwap
///         (no twapIncrement gate) and migrates balances from the old bot.
///
/// Why redeploy: the original bot's _tryTwap blocked when `ethToTwap < twapIncrement`,
/// which silently dropped TWAP burns when fees accumulated below the chunk size.
/// The strategy's processTokenTwap handles dust gracefully — bot's gate was redundant.
///
/// USAGE:
///   forge script script/RedeployBot.s.sol:RedeployBot \
///     --rpc-url https://base-sepolia-rpc.publicnode.com \
///     --broadcast --interactive -vvvv
///
/// (caller must be the owner EOA — same as old bot owner)
contract RedeployBot is Script {
    address constant STRATEGY = 0x6ddbC0bF9e8Bb2f8Bd9Dfd27876197340dDc7EB2;
    address constant TLINEA = 0x88a8D5ED5D1be44098F226EDf11C3160Fd76421F;
    address payable constant OLD_BOT = payable(0x5CAbfF553d8D7B9564CceE758A22b58c850d23Fc);
    address constant OWNER = 0xbc6af64859dF1008c8187F94dF89323000dEE668;
    address constant KEEPER = 0xbc6af64859dF1008c8187F94dF89323000dEE668;

    function run() external {
        vm.startBroadcast();

        // 1. Deploy new bot
        LineaDATBot newBot = new LineaDATBot(STRATEGY, TLINEA, KEEPER, OWNER);
        console.log("[1] new LineaDATBot:", address(newBot));

        // 2. Drain old bot's tLINEA → new bot
        uint256 tlineaBalance = IERC20Min(TLINEA).balanceOf(OLD_BOT);
        if (tlineaBalance > 0) {
            LineaDATBot(OLD_BOT).withdrawUnderlying(address(newBot), tlineaBalance);
            console.log("[2] Drained tLINEA from old bot:", tlineaBalance);
        }

        // 3. Drain old bot's ETH → new bot
        uint256 ethBalance = OLD_BOT.balance;
        if (ethBalance > 0) {
            LineaDATBot(OLD_BOT).withdrawETH(address(newBot), ethBalance);
            console.log("[3] Drained ETH from old bot:", ethBalance);
        }

        // 4. Whitelist new bot as distributor (so its tLINEA balance doesn't get
        //    blocked by strategy's _afterTokenTransfer transient allowance check)
        IStrategySetters(STRATEGY).setDistributor(address(newBot), true);
        console.log("[4] strategy.setDistributor(newBot, true)");

        // 5. (Optional) leave old bot in distributor whitelist — harmless after drain.
        //    We don't disable it to avoid any edge cases where in-flight tx might still reference it.

        // 6. Decommission old bot — set keeper to a burn address so it can't be triggered again.
        //    Only owner can call this, and we are the owner via this broadcast.
        LineaDATBot(OLD_BOT).setKeeper(0x000000000000000000000000000000000000dEaD);
        console.log("[5] old bot keeper rotated to dEaD");

        vm.stopBroadcast();

        console.log("---");
        console.log("NEW BOT_ADDR:", address(newBot));
        console.log("Update: Fly secrets BOT_ADDR + frontend env BOT_ADDR");
    }
}

interface IERC20Min {
    function balanceOf(address) external view returns (uint256);
}

interface IStrategySetters {
    function setDistributor(address, bool) external;
}
