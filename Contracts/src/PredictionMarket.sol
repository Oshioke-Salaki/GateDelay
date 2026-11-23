// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./PositionToken.sol";

/// @notice Minimal interface to the canonical LMSR `MarketMaker` engine.
interface IMarketMakerAdapter {
    function getPrice(uint256 marketId, uint256 outcome) external view returns (uint256);
    function getCostToBuy(uint256 marketId, uint256 outcome, uint256 shares) external view returns (uint256);
    function getProceedsToSell(uint256 marketId, uint256 outcome, uint256 shares) external view returns (uint256);
    function positions(address user, uint256 marketId, uint256 outcome) external view returns (uint256);
    function getMarketReserve(uint256 marketId) external view returns (uint256);
    function getMarketLiability(uint256 marketId) external view returns (uint256);
    function getRequiredSubsidy(uint256 marketId) external view returns (uint256);
    function isMarketSolvent(uint256 marketId) external view returns (bool);
    function fundMarket(uint256 marketId, uint256 amount) external;
    function buyFor(uint256 marketId, address trader, uint256 outcome, uint256 shares, uint256 maxCost)
        external
        returns (uint256);
    function sellFor(uint256 marketId, address trader, uint256 outcome, uint256 shares, uint256 minProceeds)
        external
        returns (uint256);
    function redeemFor(uint256 marketId, address trader) external returns (uint256);
}

/// @title PredictionMarket
/// @notice Executable prediction market contract deployed by `MarketFactory`.
/// @dev When bound to a canonical `MarketMaker` via `bindCanonicalMarket`, all LMSR
///      pricing, position accounting, collateral reserves, resolution, and redemptions
///      are owned by `MarketMaker` as the single source of truth.
contract PredictionMarket {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error Unauthorized();
    error InvalidMarketState();
    error MarketAlreadyResolved();
    error MarketNotResolved();
    error InvalidOutcome();
    error ZeroAmount();
    error InsufficientBalance();
    error InsufficientAllowance();
    error InvalidResolution();
    error OnlyFactory();
    error InsufficientLiquidity();
    error CanonicalAlreadyBound();
    error CanonicalMarketNotBound();
    error CanonicalMarketUsesMarketMaker();
    error OnlyMarketMaker();
    error SlippageExceeded();
    error TransferFailed();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    enum MarketState {
        OPEN,
        PAUSED,
        RESOLVED,
        DISPUTED,
        CANCELLED
    }

    struct MarketParams {
        address collateralToken;
        uint256 resolutionDeadline;
        uint256 minLiquidity;
        string metadataURI;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event MarketInitialized(
        address indexed creator,
        address indexed collateralToken,
        uint256 resolutionDeadline,
        uint256 minLiquidity,
        string metadataURI
    );
    event CanonicalMarketBound(
        address indexed market, address indexed marketMaker, uint256 indexed canonicalMarketId
    );
    event LiquidityAdded(address indexed provider, uint256 amount);
    event SharesMinted(address indexed user, uint256 outcome, uint256 shares);
    event SharesBurned(address indexed user, uint256 outcome, uint256 shares);
    event CanonicalTradeExecuted(
        address indexed trader, bool isBuy, uint256 outcome, uint256 shares, uint256 collateralAmount
    );
    event MarketResolved(address indexed market, uint256 winningOutcome);
    event CanonicalRedeemed(address indexed trader, uint256 payout);
    event MarketPaused(address indexed market);
    event MarketUnpaused(address indexed market);

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    address public immutable factory;
    address public immutable positionToken;

    address public immutable collateralToken;
    uint256 public immutable resolutionDeadline;
    uint256 public immutable minLiquidity;
    string public metadataURI;

    MarketState public state;
    uint256 public winningOutcome;
    uint256 public totalLiquidity;
    bool public initialized;

    /// @notice Canonical LMSR MarketMaker bound to this market instance.
    address public marketMaker;

    /// @notice Numeric marketId in `marketMaker` paired 1:1 with this contract.
    uint256 public canonicalMarketId;

    /// @notice True once bound by `factory` to its canonical `MarketMaker` market.
    bool public canonicalBound;

    // Legacy user positions (used only when `canonicalBound == false`): user => outcome => shares
    mapping(address => mapping(uint256 => uint256)) public userPositions;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(
        address _factory,
        address _positionToken,
        address _collateralToken,
        uint256 _resolutionDeadline,
        uint256 _minLiquidity,
        string memory _metadataURI
    ) {
        if (_factory == address(0)) revert Unauthorized();
        if (_positionToken == address(0)) revert Unauthorized();
        if (_collateralToken == address(0)) revert Unauthorized();

        factory = _factory;
        positionToken = _positionToken;
        collateralToken = _collateralToken;
        resolutionDeadline = _resolutionDeadline;
        minLiquidity = _minLiquidity;
        metadataURI = _metadataURI;
        state = MarketState.OPEN;
    }

    // -------------------------------------------------------------------------
    // Factory-only initialization & canonical LMSR binding
    // -------------------------------------------------------------------------

    /// @notice Initialize the market after CREATE2 deployment.
    /// @dev Only callable by the factory.
    function initialize(
        address _creator,
        address _collateralToken,
        uint256 _resolutionDeadline,
        uint256 _minLiquidity,
        string memory _metadataURI
    ) external {
        if (msg.sender != factory) revert OnlyFactory();
        if (initialized) revert InvalidMarketState();

        initialized = true;
        emit MarketInitialized(_creator, _collateralToken, _resolutionDeadline, _minLiquidity, _metadataURI);
    }

    /// @notice Bind this market instance 1:1 to its canonical numeric market in `MarketMaker`.
    /// @param _marketMaker Address of the canonical `MarketMaker`.
    /// @param _canonicalMarketId Numeric market ID registered in `_marketMaker`.
    /// @dev Access: Restricted to `factory`; can only be called once.
    function bindCanonicalMarket(address _marketMaker, uint256 _canonicalMarketId) external {
        if (msg.sender != factory) revert OnlyFactory();
        if (canonicalBound) revert CanonicalAlreadyBound();
        if (_marketMaker == address(0)) revert Unauthorized();

        marketMaker = _marketMaker;
        canonicalMarketId = _canonicalMarketId;
        canonicalBound = true;

        emit CanonicalMarketBound(address(this), _marketMaker, _canonicalMarketId);
    }

    // -------------------------------------------------------------------------
    // Liquidity management
    // -------------------------------------------------------------------------

    /// @notice Add collateral liquidity to the market.
    /// @param amount Amount of collateral tokens to add.
    /// @dev When bound to `MarketMaker`, collateral is forwarded directly into
    ///      `MarketMaker.fundMarket(canonicalMarketId, amount)` so reserves are never split.
    function addLiquidity(uint256 amount) external {
        if (state != MarketState.OPEN) revert InvalidMarketState();
        if (amount == 0) revert ZeroAmount();

        IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), amount);

        if (canonicalBound) {
            IERC20(collateralToken).forceApprove(marketMaker, amount);
            IMarketMakerAdapter(marketMaker).fundMarket(canonicalMarketId, amount);
        }

        totalLiquidity += amount;
        emit LiquidityAdded(msg.sender, amount);
    }

    /// @notice Check if market meets minimum liquidity and canonical LMSR solvency.
    /// @return True if minimum liquidity is satisfied.
    function hasMinLiquidity() public view returns (bool) {
        if (canonicalBound) {
            uint256 reserve = IMarketMakerAdapter(marketMaker).getMarketReserve(canonicalMarketId);
            uint256 requiredSubsidy = IMarketMakerAdapter(marketMaker).getRequiredSubsidy(canonicalMarketId);
            return reserve >= minLiquidity && reserve >= requiredSubsidy
                && IMarketMakerAdapter(marketMaker).isMarketSolvent(canonicalMarketId);
        }
        return totalLiquidity >= minLiquidity;
    }

    /// @notice Revert if the market does not have the required minimum liquidity.
    function requireMinLiquidity() external view {
        if (!hasMinLiquidity()) revert InsufficientLiquidity();
    }

    // -------------------------------------------------------------------------
    // Canonical LMSR pricing & trading delegation
    // -------------------------------------------------------------------------

    /// @notice Return the canonical LMSR spot price for `outcome` (0-indexed, WAD).
    function getPrice(uint256 outcome) external view returns (uint256) {
        if (!canonicalBound) revert CanonicalMarketNotBound();
        return IMarketMakerAdapter(marketMaker).getPrice(canonicalMarketId, outcome);
    }

    /// @notice Quote collateral cost to buy `shares` of `outcome` via canonical LMSR.
    function getCostToBuy(uint256 outcome, uint256 shares) external view returns (uint256) {
        if (!canonicalBound) revert CanonicalMarketNotBound();
        return IMarketMakerAdapter(marketMaker).getCostToBuy(canonicalMarketId, outcome, shares);
    }

    /// @notice Quote collateral proceeds to sell `shares` of `outcome` via canonical LMSR.
    function getProceedsToSell(uint256 outcome, uint256 shares) external view returns (uint256) {
        if (!canonicalBound) revert CanonicalMarketNotBound();
        return IMarketMakerAdapter(marketMaker).getProceedsToSell(canonicalMarketId, outcome, shares);
    }

    /// @notice Return `user`'s position for `outcome` from the canonical position ledger.
    function getPosition(address user, uint256 outcome) external view returns (uint256) {
        if (canonicalBound) {
            return IMarketMakerAdapter(marketMaker).positions(user, canonicalMarketId, outcome);
        }
        return userPositions[user][outcome];
    }

    /// @notice Return this market's isolated collateral reserve in `MarketMaker`.
    function getReserve() external view returns (uint256) {
        if (!canonicalBound) revert CanonicalMarketNotBound();
        return IMarketMakerAdapter(marketMaker).getMarketReserve(canonicalMarketId);
    }

    /// @notice Return this market's current maximum liability in `MarketMaker`.
    function getLiability() external view returns (uint256) {
        if (!canonicalBound) revert CanonicalMarketNotBound();
        return IMarketMakerAdapter(marketMaker).getMarketLiability(canonicalMarketId);
    }

    /// @notice Buy `shares` of `outcome` (0-indexed) through the canonical `MarketMaker`.
    /// @param outcome Canonical 0-indexed outcome (`0 .. numOutcomes - 1`).
    /// @param shares Number of shares to buy (WAD).
    /// @param maxCost Maximum collateral willing to spend.
    /// @return cost Collateral transferred to `MarketMaker` for this trade.
    function buy(uint256 outcome, uint256 shares, uint256 maxCost) external returns (uint256 cost) {
        if (!canonicalBound) revert CanonicalMarketNotBound();
        if (state != MarketState.OPEN) revert InvalidMarketState();
        if (shares == 0) revert ZeroAmount();

        uint256 quotedCost = IMarketMakerAdapter(marketMaker).getCostToBuy(canonicalMarketId, outcome, shares);
        if (quotedCost == 0) revert ZeroAmount();
        if (quotedCost > maxCost) revert SlippageExceeded();

        IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), quotedCost);
        IERC20(collateralToken).forceApprove(marketMaker, quotedCost);

        cost = IMarketMakerAdapter(marketMaker).buyFor(canonicalMarketId, msg.sender, outcome, shares, maxCost);
        emit CanonicalTradeExecuted(msg.sender, true, outcome, shares, cost);
    }

    /// @notice Sell `shares` of `outcome` (0-indexed) through the canonical `MarketMaker`.
    /// @param outcome Canonical 0-indexed outcome (`0 .. numOutcomes - 1`).
    /// @param shares Number of shares to sell (WAD).
    /// @param minProceeds Minimum collateral proceeds required.
    /// @return proceeds Collateral transferred directly from `MarketMaker` to `msg.sender`.
    function sell(uint256 outcome, uint256 shares, uint256 minProceeds) external returns (uint256 proceeds) {
        if (!canonicalBound) revert CanonicalMarketNotBound();
        if (state != MarketState.OPEN) revert InvalidMarketState();
        if (shares == 0) revert ZeroAmount();

        proceeds = IMarketMakerAdapter(marketMaker).sellFor(canonicalMarketId, msg.sender, outcome, shares, minProceeds);
        emit CanonicalTradeExecuted(msg.sender, false, outcome, shares, proceeds);
    }

    // -------------------------------------------------------------------------
    // Legacy position management (disabled on canonical LMSR markets)
    // -------------------------------------------------------------------------

    /// @notice Legacy unpriced minting; disabled on canonical LMSR-bound markets.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `CanonicalMarketUsesMarketMaker` if `canonicalBound` is true.
    ///     `InvalidMarketState` if `state != MarketState.OPEN` is true. `InsufficientLiquidity` if
    ///     `!hasMinLiquidity()` is true. `InvalidOutcome` if `outcome != 1 && outcome != 2` is true.
    ///     `ZeroAmount` if `shares == 0` is true. "Payment required" if `collateralAmount == 0` is
    ///     true.
    function mintPosition(uint256 outcome, uint256 shares) external {
        if (canonicalBound) revert CanonicalMarketUsesMarketMaker();
        if (state != MarketState.OPEN) revert InvalidMarketState();
        if (!hasMinLiquidity()) revert InsufficientLiquidity();
        if (outcome != 1 && outcome != 2) revert InvalidOutcome();
        if (shares == 0) revert ZeroAmount();

        // Collect collateral equal to shares minted
        uint256 collateralAmount = shares;
        require(collateralAmount > 0, "Payment required");
        
        IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), collateralAmount);

        totalLiquidity += collateralAmount;

        PositionToken(positionToken).mint(msg.sender, _positionId(outcome), shares, "");
        userPositions[msg.sender][outcome] += shares;

        emit SharesMinted(msg.sender, outcome, shares);
    }

    /// @notice Legacy unpriced burning; disabled on canonical LMSR-bound markets.
    function burnPosition(uint256 outcome, uint256 shares) external {
        if (canonicalBound) revert CanonicalMarketUsesMarketMaker();
        if (state != MarketState.OPEN) revert InvalidMarketState();
        if (!hasMinLiquidity()) revert InsufficientLiquidity();
        if (outcome != 1 && outcome != 2) revert InvalidOutcome();
        if (shares == 0) revert ZeroAmount();
        if (userPositions[msg.sender][outcome] < shares) revert InsufficientBalance();

        PositionToken(positionToken).burn(msg.sender, _positionId(outcome), shares);
        userPositions[msg.sender][outcome] -= shares;

        emit SharesBurned(msg.sender, outcome, shares);
    }

    // -------------------------------------------------------------------------
    // Resolution & redemption
    // -------------------------------------------------------------------------

    /// @notice Legacy resolution entrypoint; disabled on canonical LMSR-bound markets so
    ///         approved resolver, evidence, and timing checks in `MarketMaker` cannot be bypassed.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `CanonicalMarketUsesMarketMaker` if `canonicalBound` is true. `Unauthorized`
    ///     if `msg.sender != factory` is true. `MarketAlreadyResolved` if `state ==
    ///     MarketState.RESOLVED` is true. `InvalidResolution` if `block.timestamp <
    ///     resolutionDeadline` is true. `InvalidOutcome` if `_winningOutcome != 1 && _winningOutcome
    ///     != 2` is true.
    function resolve(uint256 _winningOutcome) external {
        if (canonicalBound) revert CanonicalMarketUsesMarketMaker();
        if (msg.sender != factory) revert Unauthorized();
        if (state == MarketState.RESOLVED) revert MarketAlreadyResolved();
        if (block.timestamp < resolutionDeadline) revert InvalidResolution();
        if (_winningOutcome != 1 && _winningOutcome != 2) revert InvalidOutcome();

        state = MarketState.RESOLVED;
        winningOutcome = _winningOutcome;

        emit MarketResolved(address(this), _winningOutcome);
    }

    /// @notice Synchronize resolution state from the canonical `MarketMaker`.
    /// @param _winningOutcome Canonical winning outcome accepted by `MarketMaker`.
    /// @dev Access: Restricted exclusively to the bound `marketMaker`.
    function onCanonicalResolved(uint256 _winningOutcome) external {
        if (!canonicalBound || msg.sender != marketMaker) revert OnlyMarketMaker();
        if (state == MarketState.RESOLVED) revert MarketAlreadyResolved();

        state = MarketState.RESOLVED;
        winningOutcome = _winningOutcome;

        emit MarketResolved(address(this), _winningOutcome);
    }

    /// @notice Redeem winning shares for collateral.
    /// @dev When bound to `MarketMaker`, delegates to `MarketMaker.redeemFor` so payouts
    ///      draw strictly from this market's isolated reserve in `MarketMaker`.
    function redeem() external {
        if (state != MarketState.RESOLVED) revert MarketNotResolved();

        if (canonicalBound) {
            uint256 payout = IMarketMakerAdapter(marketMaker).redeemFor(canonicalMarketId, msg.sender);
            emit CanonicalRedeemed(msg.sender, payout);
            return;
        }

        uint256 shares = userPositions[msg.sender][winningOutcome];
        if (shares == 0) revert ZeroAmount();

        PositionToken(positionToken).burn(msg.sender, _positionId(winningOutcome), shares);
        userPositions[msg.sender][winningOutcome] = 0;

        IERC20(collateralToken).safeTransfer(msg.sender, shares);
    }

    // -------------------------------------------------------------------------
    // Admin functions
    // -------------------------------------------------------------------------

    /// @notice Pause the market.
    /// @dev Access: Only callable by factory (governance forwards through the factory).
    function pause() external {
        if (msg.sender != factory) revert OnlyFactory();
        if (state != MarketState.OPEN) revert InvalidMarketState();

        state = MarketState.PAUSED;
        emit MarketPaused(address(this));
    }

    /// @notice Unpause the market.
    /// @dev Access: Only callable by factory (governance forwards through the factory).
    function unpause() external {
        if (msg.sender != factory) revert OnlyFactory();
        if (state != MarketState.PAUSED) revert InvalidMarketState();

        state = MarketState.OPEN;
        emit MarketUnpaused(address(this));
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------
    function _positionId(uint256 outcome) internal view returns (uint256) {
        return (uint256(uint160(address(this))) << 1) | outcome;
    }

    // -------------------------------------------------------------------------
    // Fallback
    // -------------------------------------------------------------------------
    receive() external payable {}
}
