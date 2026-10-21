// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./PositionToken.sol";

/// @title PredictionMarket
/// @notice Executable prediction market contract deployed by MarketFactory.
contract PredictionMarket {
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

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    enum MarketState { OPEN, PAUSED, RESOLVED, DISPUTED, CANCELLED, PENDING }

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
    event LiquidityAdded(address indexed provider, uint256 amount);
    event SharesMinted(address indexed user, uint256 outcome, uint256 shares);
    event SharesBurned(address indexed user, uint256 outcome, uint256 shares);
    event MarketResolved(address indexed market, uint256 winningOutcome);
    event MarketPaused(address indexed market);
    event MarketUnpaused(address indexed market);
    event MarketActivated(address indexed market, uint256 liquidity);
    event MarketDisputed(address indexed market);
    event MarketCancelled(address indexed market);

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

    // User positions: user => outcome => shares
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
        state = MarketState.PENDING;
    }

    // -------------------------------------------------------------------------
    // Factory-only initialization (for CREATE2 deployment)
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
        
        // Params are already set in constructor, just mark as initialized
        initialized = true;
        emit MarketInitialized(_creator, _collateralToken, _resolutionDeadline, _minLiquidity, _metadataURI);
    }

    // -------------------------------------------------------------------------
    // Liquidity management
    // -------------------------------------------------------------------------
    /// @notice Add liquidity to the market.
    /// @param amount Amount of collateral tokens to add.
    /// @dev Access: Any user can add liquidity.
    function addLiquidity(uint256 amount) external {
        if (state != MarketState.PENDING && state != MarketState.OPEN) revert InvalidMarketState();
        if (amount == 0) revert ZeroAmount();
        
        IERC20(collateralToken).transferFrom(msg.sender, address(this), amount);
        totalLiquidity += amount;
        
        emit LiquidityAdded(msg.sender, amount);
    }

    /// @notice Check if market has minimum liquidity.
    /// @return True if minimum liquidity is met.
    function hasMinLiquidity() external view returns (bool) {
        return totalLiquidity >= minLiquidity;
    }

    /// @notice Activate trading once minimum liquidity is deposited. Factory-only.
    function activate() external {
        if (msg.sender != factory) revert OnlyFactory();
        if (state != MarketState.PENDING) revert InvalidMarketState();
        if (totalLiquidity < minLiquidity) revert InsufficientLiquidity();

        state = MarketState.OPEN;
        emit MarketActivated(address(this), totalLiquidity);
    }

    // -------------------------------------------------------------------------
    // Position management (mint/burn via PositionToken)
    // -------------------------------------------------------------------------
    /// @notice Buy position shares for an outcome.
    /// @param outcome Outcome index (1 for YES, 2 for NO).
    /// @param shares Number of shares to mint.
    /// @dev Access: Only callable by authorized contracts.
    function mintPosition(uint256 outcome, uint256 shares) external {
        if (state != MarketState.OPEN) revert InvalidMarketState();
        if (outcome != 1 && outcome != 2) revert InvalidOutcome();
        if (shares == 0) revert ZeroAmount();
        
        // Mint position tokens via PositionToken
        PositionToken(positionToken).mint(msg.sender, _positionId(outcome), shares, "");
        userPositions[msg.sender][outcome] += shares;
        
        emit SharesMinted(msg.sender, outcome, shares);
    }

    /// @notice Sell position shares for an outcome.
    /// @param outcome Outcome index (1 for YES, 2 for NO).
    /// @param shares Number of shares to burn.
    /// @dev Access: Only callable by authorized contracts.
    function burnPosition(uint256 outcome, uint256 shares) external {
        if (state != MarketState.OPEN) revert InvalidMarketState();
        if (outcome != 1 && outcome != 2) revert InvalidOutcome();
        if (shares == 0) revert ZeroAmount();
        if (userPositions[msg.sender][outcome] < shares) revert InsufficientBalance();
        
        // Burn position tokens via PositionToken
        PositionToken(positionToken).burn(msg.sender, _positionId(outcome), shares);
        userPositions[msg.sender][outcome] -= shares;
        
        emit SharesBurned(msg.sender, outcome, shares);
    }

    // -------------------------------------------------------------------------
    // Resolution
    // -------------------------------------------------------------------------
    /// @notice Resolve the market with a winning outcome.
    /// @param _winningOutcome Winning outcome (1 for YES, 2 for NO).
    /// @dev Access: Only callable by factory or authorized resolver.
    function resolve(uint256 _winningOutcome) external {
        if (msg.sender != factory) revert OnlyFactory();
        if (state == MarketState.RESOLVED) revert MarketAlreadyResolved();
        if (state != MarketState.OPEN && state != MarketState.DISPUTED) revert InvalidMarketState();
        if (block.timestamp < resolutionDeadline) revert InvalidResolution();
        if (_winningOutcome != 1 && _winningOutcome != 2) revert InvalidOutcome();

        state = MarketState.RESOLVED;
        winningOutcome = _winningOutcome;

        emit MarketResolved(address(this), _winningOutcome);
    }

    /// @notice Mark the market disputed. Factory-only.
    function dispute() external {
        if (msg.sender != factory) revert OnlyFactory();
        if (state != MarketState.RESOLVED && state != MarketState.OPEN) revert InvalidMarketState();
        state = MarketState.DISPUTED;
        emit MarketDisputed(address(this));
    }

    /// @notice Cancel the market. Factory-only.
    function cancel() external {
        if (msg.sender != factory) revert OnlyFactory();
        if (state == MarketState.RESOLVED || state == MarketState.CANCELLED) revert InvalidMarketState();
        state = MarketState.CANCELLED;
        emit MarketCancelled(address(this));
    }

    /// @notice Redeem winning shares for collateral.
    /// @dev Access: Only callable by factory or authorized resolver.
    function redeem() external {
        if (state != MarketState.RESOLVED) revert MarketNotResolved();
        
        uint256 shares = userPositions[msg.sender][winningOutcome];
        if (shares == 0) revert ZeroAmount();
        
        // Burn winning shares
        PositionToken(positionToken).burn(msg.sender, _positionId(winningOutcome), shares);
        userPositions[msg.sender][winningOutcome] = 0;
        
        // Transfer collateral to user
        IERC20(collateralToken).transfer(msg.sender, shares);
    }

    // -------------------------------------------------------------------------
    // Admin functions
    // -------------------------------------------------------------------------
    /// @notice Pause the market.
    /// @dev Access: Only callable by factory.
    function pause() external {
        if (msg.sender != factory) revert OnlyFactory();
        if (state != MarketState.OPEN) revert InvalidMarketState();
        
        state = MarketState.PAUSED;
        emit MarketPaused(address(this));
    }

    /// @notice Unpause the market.
    /// @dev Access: Only callable by factory.
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
        // Position ID encoding: (marketAddress << 1) | outcome
        // outcome: 1 = YES, 2 = NO
        return (uint256(uint160(address(this))) << 1) | outcome;
    }

    // -------------------------------------------------------------------------
    // Fallback
    // -------------------------------------------------------------------------
    receive() external payable {}
}