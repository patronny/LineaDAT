// SPDX-License-Identifier: MIT
// Based on TokenWorks ERC20Strategy v3 (MIT). Original: token.works
pragma solidity ^0.8.26;

import {ERC20} from "solady/tokens/ERC20.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";

import {BaseStrategy} from "./BaseStrategy.sol";

/// @title LINEASTRStrategy - An ERC20 strategy token backed by $LINEA on Linea L2
/// @author Based on TokenWorks ERC20Strategy v3 (MIT)
/// @notice This contract implements an ERC20 token backed by $LINEA.
///         Users can trade the token on Uniswap V4, and the contract uses trading fees to buy bags of the underlying token.
/// @dev Uses ERC1967 proxy pattern with immutable args for gas-efficient upgrades
contract LINEASTRStrategy is BaseStrategy {
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™                ™™™™™™™™™™™                ™™™™™™™™™™™ */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™               ™™™™™™™™™™™™™              ™™™™™™™™™™  */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™              ™™™™™™™™™™™™™              ™™™™™™™™™™™  */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™             ™™™™™™™™™™™™™™            ™™™™™™™™™™™   */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™            ™™™™™™™™™™™™™™™            ™™™™™™™™™™™   */
    /*                ™™™™™™™™™™™            ™™™™™™™™™™™           ™™™™™™™™™™™™™™™           ™™™™™™™™™™™    */
    /*                ™™™™™™™™™™™             ™™™™™™™™™™          ™™™™™™™™™™™™™™™™™          ™™™™™™™™™™™    */
    /*                ™™™™™™™™™™™             ™™™™™™™™™™          ™™™™™™™™™™™™™™™™™          ™™™™™™™™™™     */
    /*                ™™™™™™™™™™™              ™™™™™™™™™™        ™™™™™™™™™™™™™™™™™™™        ™™™™™™™™™™™     */
    /*                ™™™™™™™™™™™              ™™™™™™™™™™™       ™™™™™™™™™ ™™™™™™™™™       ™™™™™™™™™™™      */
    /*                ™™™™™™™™™™™               ™™™™™™™™™™      ™™™™™™™™™™ ™™™™™™™™™™      ™™™™™™™™™™™      */
    /*                ™™™™™™™™™™™               ™™™™™™™™™™      ™™™™™™™™™   ™™™™™™™™™      ™™™™™™™™™™       */
    /*                ™™™™™™™™™™™                ™™™™™™™™™™    ™™™™™™™™™™    ™™™™™™™™™    ™™™™™™™™™™        */
    /*                ™™™™™™™™™™™                 ™™™™™™™™™™   ™™™™™™™™™     ™™™™™™™™™™  ™™™™™™™™™™™        */
    /*                ™™™™™™™™™™™                 ™™™™™™™™™™  ™™™™™™™™™™     ™™™™™™™™™™  ™™™™™™™™™™         */
    /*                ™™™™™™™™™™™                  ™™™™™™™™™™™™™™™™™™™™       ™™™™™™™™™™™™™™™™™™™™          */
    /*                ™™™™™™™™™™™                   ™™™™™™™™™™™™™™™™™™         ™™™™™™™™™™™™™™™™™™           */
    /*                ™™™™™™™™™™™                   ™™™™™™™™™™™™™™™™™™         ™™™™™™™™™™™™™™™™™™           */
    /*                ™™™™™™™™™™™                    ™™™™™™™™™™™™™™™™           ™™™™™™™™™™™™™™™™            */
    /*                ™™™™™™™™™™™                     ™™™™™™™™™™™™™™             ™™™™™™™™™™™™™™             */
    /*                ™™™™™™™™™™™                     ™™™™™™™™™™™™™™             ™™™™™™™™™™™™™™             */
    /*                ™™™™™™™™™™™                      ™™™™™™™™™™™™               ™™™™™™™™™™™™              */

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                     CONSTANTS                       */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    /// @notice The token this strategy is tied to
    ERC20 public token;
    /// @notice The amount of tokens this strategy buys per call
    uint256 public bagSize;

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                   STATE VARIABLES                   */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    /// @notice Mapping of bagId (block.number) => price
    mapping(uint256 => uint256) public onSale;
    /// @notice id of the last bag of tokens bought
    uint256 public lastBagId;

    /// @notice Storage gap for future upgrades (prevents storage collisions)
    uint256[50] private __gap;

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                   CUSTOM EVENTS                     */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    /// @notice Emitted when the protocol buys from the token
    event ERC20BoughtByProtocol(
        uint256 indexed bagId,
        uint256 purchasePrice,
        uint256 listPrice
    );
    /// @notice Emitted when the protocol buys from the token
    event ERC20SoldByProtocol(
        uint256 indexed bagId,
        uint256 price,
        address buyer
    );

    /// @notice Emitted when the owner() updates bagSize
    event UpdatedBagSize(uint256 newBagSize);

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                    CUSTOM ERRORS                    */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    /// @notice given ERC20 bag id is not currently for sale
    error NotForSale();
    /// @notice Sent ETH amount is less than the bag sale price
    error PriceTooLow();
    /// @notice Call didn't result in buying the right amount of the token
    error BalanceMismatch();
    /// @notice triggered when trying to buy tokens for 0
    error NoZeroBuys();
    /// @notice triggered when there is an error in inputs
    error InputsError();
    /// @notice triggered when updating bagSize after tokens have been purchased
    error TokensAlreadyPurchased();

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                    CONSTRUCTOR                      */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    /// @notice Constructor calls BaseStrategy() to disable initializers
    /// @dev This is required for the proxy pattern to work correctly
    constructor() BaseStrategy() {}

    /// @notice Initializes the contract with required addresses and permissions
    /// @param _token Address of the underlying ERC20 contract
    /// @param _bagSize Size of the bag of token to buy at once
    /// @param _hook Address of the StrategyHook contract
    /// @param _tokenName Name of the token
    /// @param _tokenSymbol Symbol of the token
    /// @param _buyIncrement Buy increment for the token
    /// @param _owner Owner of the contract
    function initialize(
        address _token,
        uint256 _bagSize,
        address _hook,
        string memory _tokenName,
        string memory _tokenSymbol,
        uint256 _buyIncrement,
        address _owner
    ) external initializer {
        require(_token != address(0), "Invalid token");
        require(_bagSize != 0, "Invalid bag size");

        token = ERC20(_token);
        bagSize = _bagSize;

        __BaseStrategy_init(
            _hook,
            _tokenName,
            _tokenSymbol,
            _buyIncrement,
            _owner
        );
    }

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                 GETTERS                             */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    /// @dev this must be incremented whenever there is any change in BaseStrategy or this strategy
    function VERSION() public pure override returns (uint256) {
        return 3;
    }

    /// @notice Owner-only escape hatch to drain LINEASTR tokens from the factory address.
    /// @dev Phase 3.5 testnet helper. The factory holds the entire 1B mint after deployStrategy
    ///      (BaseStrategy.__BaseStrategy_init mints to factory()), but our minimal LINEASTRFactory
    ///      lacks a seedLiquidity orchestration. This function lets the owner pull tokens out so a
    ///      script can run the v4 pool seed flow externally. Phase 4 mainnet must replace this with
    ///      a proper factory.seedLiquidity(...) function (see TODO docs/85-phase-3-5-results.md).
    ///
    ///      Marks `to` as a distributor before the transfer so _afterTokenTransfer's whitelist
    ///      check passes. Caller is responsible for unsetting via setDistributor(to, false) later.
    function factoryEscape(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        isDistributor[to] = true;
        _transfer(factory(), to, amount);
    }

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                 MECHANISM FUNCTIONS                 */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    /// @notice Buys {bagSize} tokens from {msg.sender} using the {availableFunds()} and relist
    /// @dev callers needs to give allowance to current contract for transfer
    function buyTokens() external nonReentrant {
        uint256 funds = availableFunds();

        // this prevents tokens from being locked in contract because if salePrice == 0
        // tokens would be seen as not on sale
        if (funds == 0) {
            revert NoZeroBuys();
        }

        uint256 bagId = (++lastBagId);

        uint256 tokenBalanceBefore = token.balanceOf(address(this));

        SafeTransferLib.safeTransferFrom(
            address(token),
            msg.sender,
            address(this),
            bagSize
        );

        // TODO: not certain this is needed but it doesn't hurt to double check, right?
        if (token.balanceOf(address(this)) != tokenBalanceBefore + bagSize) {
            revert BalanceMismatch();
        }

        currentFees -= funds;

        uint256 listPrice = (funds * priceMultiplier) / 1000;
        onSale[bagId] = listPrice;

        // Update last buy block to reset max price calculation
        lastBuyBlock = block.number;

        SafeTransferLib.forceSafeTransferETH(msg.sender, funds);

        emit ERC20BoughtByProtocol(bagId, funds, listPrice);
    }

    /// @notice Sell a bag that was previously bought and listed
    /// @param bagId The ID of the bag to sell
    function sellTokens(uint256 bagId) external payable nonReentrant {
        // Get sale price
        uint256 salePrice = onSale[bagId];

        // Verify bag is for sale
        if (salePrice == 0) revert NotForSale();

        // Verify sent ETH matches sale price
        if (msg.value != salePrice) revert PriceTooLow();

        // Remove from sale
        delete onSale[bagId];

        // Transfer tokens to buyer
        token.transfer(msg.sender, bagSize);

        // Add sale price to fees
        ethToTwap += salePrice;

        emit ERC20SoldByProtocol(bagId, salePrice, msg.sender);
    }

    /// @notice Update the bag size
    /// @param newBagSize The new bag size to set
    function updateBagSize(uint256 newBagSize) external onlyOwner {
        if (newBagSize == 0) revert InputsError();
        // bagId must be 0 when updating bag size
        if (lastBagId != 0) revert TokensAlreadyPurchased();
        bagSize = newBagSize;

        // Update last buy block to reset max price calculation
        lastBuyBlock = block.number;
        emit UpdatedBagSize(newBagSize);
    }

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                  GETTER FUNCTIONS                   */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    /// @notice Returns all onSale prices from id 0 to {lastBagId} included
    /// @dev switch to list(start, end) if this function ever revert because too much gas
    /// @return bags all onSale prices from id 0 to lastBagId
    function list() external view returns (uint256[] memory bags) {
        return list(0, lastBagId);
    }

    /// @notice Returns all onSale prices from id {startId} to {endId} included
    /// @param startId the id of the first bag
    /// @param endId the id of the last bag
    /// @return bags all onSale prices from id {startId} to {endId}
    function list(
        uint256 startId,
        uint256 endId
    ) public view returns (uint256[] memory bags) {
        if (endId < startId) {
            revert InputsError();
        }

        uint256 length = endId - startId + 1;
        bags = new uint256[](length);

        for (uint256 i; i < length; i++) {
            bags[i] = onSale[startId + i];
        }
    }
}
