// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "solady/tokens/ERC20.sol";
import {Ownable} from "solady/auth/Ownable.sol";

/// @notice Testnet stub for $LINEA on Base Sepolia.
/// @dev Mimics the canonical $LINEA token interface (name "Linea", symbol "LINEA", 18 decimals)
///      but is deployed fresh on Base Sepolia where the real $LINEA doesn't exist.
///
///      Includes a public faucet (`mint(to, amount)` with rate-limit) so testnet users can grab
///      tLINEA via the frontend or directly via cast.
///
///      Owner can mint freely (used in deploy script to seed bot capital).
contract MockTLINEA is ERC20, Ownable {
    /// @notice Maximum tokens a single address can mint via the faucet within `FAUCET_COOLDOWN`.
    uint256 public constant FAUCET_AMOUNT = 100_000 * 1e18; // 100k tLINEA per faucet drip

    /// @notice Cooldown between faucet drips for a single address.
    uint256 public constant FAUCET_COOLDOWN = 1 hours;

    /// @notice Hard cap on faucet supply (prevents griefing). 100M total via faucet.
    uint256 public constant FAUCET_TOTAL_CAP = 100_000_000 * 1e18;

    /// @notice Total minted via faucet (cumulative, never decreases).
    uint256 public faucetMinted;

    /// @notice Last faucet timestamp per address.
    mapping(address => uint256) public lastFaucetAt;

    error FaucetCooldown();
    error FaucetCapReached();

    event FaucetDripped(address indexed to, uint256 amount);

    constructor(address _owner) {
        _initializeOwner(_owner);
    }

    function name() public pure override returns (string memory) {
        return "Linea (Testnet)";
    }

    function symbol() public pure override returns (string memory) {
        return "tLINEA";
    }

    /// @notice Owner-only mint (used in deploy script to seed bot, treasury, etc.)
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @notice Public faucet - anyone can claim FAUCET_AMOUNT once per FAUCET_COOLDOWN.
    function faucetClaim() external {
        if (block.timestamp < lastFaucetAt[msg.sender] + FAUCET_COOLDOWN) revert FaucetCooldown();
        if (faucetMinted + FAUCET_AMOUNT > FAUCET_TOTAL_CAP) revert FaucetCapReached();

        lastFaucetAt[msg.sender] = block.timestamp;
        faucetMinted += FAUCET_AMOUNT;
        _mint(msg.sender, FAUCET_AMOUNT);

        emit FaucetDripped(msg.sender, FAUCET_AMOUNT);
    }
}
