// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "solady/auth/Ownable.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";

interface IERC20Min {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address a) external view returns (uint256);
}

/// @notice Standalone testnet faucet that drips 300k tLINEA per claim with 1h cooldown.
/// @dev Pre-funded by Kir1 via MockTLINEA.mint(faucet, X). Coexists with the legacy
///      MockTLINEA.faucetClaim() (100k); frontend points users at this contract.
///      Owner can adjust amount/cooldown and rescue stuck tokens.
contract LineaDATFaucet is Ownable {
    IERC20Min public immutable token;
    uint256 public faucetAmount = 300_000 * 1e18;
    uint256 public faucetCooldown = 1 hours;
    mapping(address => uint256) public lastFaucetAt;

    error FaucetCooldown();
    error FaucetEmpty();

    event FaucetDripped(address indexed to, uint256 amount);
    event FaucetAmountSet(uint256 amount);
    event FaucetCooldownSet(uint256 cooldown);

    constructor(address _token, address _owner) {
        token = IERC20Min(_token);
        _initializeOwner(_owner);
    }

    function claim() external {
        if (block.timestamp < lastFaucetAt[msg.sender] + faucetCooldown) revert FaucetCooldown();
        uint256 amt = faucetAmount;
        if (token.balanceOf(address(this)) < amt) revert FaucetEmpty();
        lastFaucetAt[msg.sender] = block.timestamp;
        SafeTransferLib.safeTransfer(address(token), msg.sender, amt);
        emit FaucetDripped(msg.sender, amt);
    }

    function setFaucetAmount(uint256 _amt) external onlyOwner {
        faucetAmount = _amt;
        emit FaucetAmountSet(_amt);
    }

    function setFaucetCooldown(uint256 _cd) external onlyOwner {
        faucetCooldown = _cd;
        emit FaucetCooldownSet(_cd);
    }

    function rescue(address to, uint256 amount) external onlyOwner {
        SafeTransferLib.safeTransfer(address(token), to, amount);
    }
}
