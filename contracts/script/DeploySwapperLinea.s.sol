// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {LineaDATTestSwapper} from "../src/LineaDATTestSwapper.sol";
import {LineaDATStrategy} from "../src/LineaDATStrategy.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

/// @notice Linea mainnet (chainId 59144) - deploy LineaDATTestSwapper and whitelist it as a
///         distributor on the deployed strategy. Mirrors DeploySwapperBaseSepolia.s.sol but for
///         Linea, with the strategy proxy supplied via env (no zombie-address hardcode).
///
///         Used in the mainnet rehearsal so the owner can drive manual Buy/Sell (and the preview
///         frontend's swap card) against the live v4 pool. LineaDATTestSwapper is chain-agnostic
///         (PoolManager.unlock). MUST run from the strategy OWNER key (setDistributor is onlyOwner)
///         or sells revert via BaseStrategy._afterTokenTransfer.
///
/// ENV VARS:
///   PRIVATE_KEY   Strategy owner EOA (the OWNER_FINAL used in Deploy.s.sol for the rehearsal)
///   STRATEGY      Deployed LineaDAT/TestDAT proxy address (from the Deploy.s.sol summary)
///
/// USAGE:
///   STRATEGY=0x... forge script script/DeploySwapperLinea.s.sol:DeploySwapperLinea \
///     --rpc-url $INFURA_LINEA --broadcast --private-key $PRIVATE_KEY -vvvv
contract DeploySwapperLinea is Script {
    address constant POOL_MANAGER = 0x248083Fb965359d82b06C1F5322480Dcfc1AD857; // Linea v4 canonical

    function run() external {
        require(block.chainid == 59144, "Must be on Linea mainnet (chainId 59144)");

        address strategyAddr = vm.envAddress("STRATEGY");
        require(strategyAddr != address(0), "STRATEGY env not set");

        vm.startBroadcast();
        LineaDATTestSwapper swapper = new LineaDATTestSwapper(IPoolManager(POOL_MANAGER));
        LineaDATStrategy proxy = LineaDATStrategy(payable(strategyAddr));
        proxy.setDistributor(address(swapper), true);
        vm.stopBroadcast();

        console.log("LineaDATTestSwapper (Linea):", address(swapper));
        console.log("Strategy:                   ", strategyAddr);
        console.log("Marked as distributor:      true");
    }
}
