// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MarketInitializer
/// @notice Initializes market parameters and state with validation and re-initialization prevention.
contract MarketInitializer {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error AlreadyInitialized();
    error InvalidMarketParameters();
    error ZeroCollateralToken();
    error InvalidDeadline();
    error ZeroMinLiquidity();
    error EmptyMetadataURI();
    error InitializationFailed();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    enum MarketStatus { UNINITIALIZED, INITIALIZED, ACTIVE, PAUSED, RESOLVED }

    struct MarketParameters {
        address collateralToken;
        uint256 resolutionDeadline;
        uint256 minLiquidity;
        string metadataURI;
        uint256 initialLiquidity;
    }

    struct MarketState {
        MarketStatus status;
        uint256 totalLiquidity;
        uint256 createdAt;
        address creator;
        bool initialized;
    }

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    /// @dev market address => MarketParameters
    mapping(address => MarketParameters) private _marketParameters;

    /// @dev market address => MarketState
    mapping(address => MarketState) private _marketState;

    /// @dev market address => initialization timestamp
    mapping(address => uint256) private _initializationTimestamp;

    /// @dev all initialized markets
    address[] private _initializedMarkets;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event MarketInitialized(
        address indexed market,
        address indexed creator,
        address indexed collateralToken,
        uint256 resolutionDeadline,
        uint256 minLiquidity
    );

    event MarketActivated(address indexed market);
    event InitializationStatusChanged(address indexed market, MarketStatus newStatus);
    event InitializationStatusUpdated(address indexed market, MarketStatus oldStatus, MarketStatus newStatus);
    event MarketLiquidityUpdated(address indexed market, uint256 oldLiquidity, uint256 newLiquidity);

    // -------------------------------------------------------------------------
    // External functions
    // -------------------------------------------------------------------------

    /// @notice Initialize a market with parameters.
    /// @param market Market address to initialize.
    /// @param params Market parameters.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `InvalidMarketParameters` if `market == address(0)` is true.
    ///     `AlreadyInitialized` if `_marketState[market].initialized` is true.
    function initializeMarket(address market, MarketParameters calldata params)
        external
    {
        if (market == address(0)) revert InvalidMarketParameters();
        if (_marketState[market].initialized) revert AlreadyInitialized();

        _validateParameters(params);

        _marketParameters[market] = params;
        _marketState[market] = MarketState({
            status: MarketStatus.INITIALIZED,
            totalLiquidity: 0,
            createdAt: block.timestamp,
            creator: msg.sender,
            initialized: true
        });

        _initializationTimestamp[market] = block.timestamp;
        _initializedMarkets.push(market);

        emit MarketInitialized(
            market,
            msg.sender,
            params.collateralToken,
            params.resolutionDeadline,
            params.minLiquidity
        );
    }

    /// @notice Activate an initialized market.
    /// @param market Market address to activate.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: `InitializationFailed` if `!state.initialized` is true.
    ///     `InvalidMarketParameters` if `state.status != MarketStatus.INITIALIZED` is true.
    function activateMarket(address market) external {
        MarketState storage state = _marketState[market];
        if (!state.initialized) revert InitializationFailed();
        if (state.status != MarketStatus.INITIALIZED) revert InvalidMarketParameters();

        MarketStatus oldStatus = state.status;
        state.status = MarketStatus.ACTIVE;
        emit MarketActivated(market);
        emit InitializationStatusChanged(market, MarketStatus.ACTIVE);
        emit InitializationStatusUpdated(market, oldStatus, MarketStatus.ACTIVE);
    }

    /// @notice Set market liquidity.
    /// @param market Market address.
    /// @param liquidity Total liquidity amount.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: `InitializationFailed` if `!state.initialized` is true.
    function setMarketLiquidity(address market, uint256 liquidity) external {
        MarketState storage state = _marketState[market];
        if (!state.initialized) revert InitializationFailed();

        uint256 oldLiquidity = state.totalLiquidity;
        state.totalLiquidity = liquidity;
        emit MarketLiquidityUpdated(market, oldLiquidity, liquidity);
    }

    // -------------------------------------------------------------------------
    // Query functions
    // -------------------------------------------------------------------------

    /// @notice Get market parameters.
    /// @param market Market address associated with this operation.
    /// @return Market parameters returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getMarketParameters(address market)
        external
        view
        returns (MarketParameters memory)
    {
        return _marketParameters[market];
    }

    /// @notice Get market state.
    /// @param market Market address associated with this operation.
    /// @return Market state returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getMarketState(address market)
        external
        view
        returns (MarketState memory)
    {
        return _marketState[market];
    }

    /// @notice Check if market is initialized.
    /// @param market Market address associated with this operation.
    /// @return True when the requested condition is met.
    /// @dev Access: No caller-specific access restriction is imposed.
    function isInitialized(address market) external view returns (bool) {
        return _marketState[market].initialized;
    }

    /// @notice Get market status.
    /// @param market Market address associated with this operation.
    /// @return Market status returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getMarketStatus(address market)
        external
        view
        returns (MarketStatus)
    {
        return _marketState[market].status;
    }

    /// @notice Get initialization timestamp.
    /// @param market Market address associated with this operation.
    /// @return Initialization timestamp returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getInitializationTimestamp(address market)
        external
        view
        returns (uint256)
    {
        return _initializationTimestamp[market];
    }

    /// @notice Get all initialized markets.
    /// @return Initialized markets returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getInitializedMarkets() external view returns (address[] memory) {
        return _initializedMarkets;
    }

    /// @notice Get initialized market count.
    /// @return Initialized market count returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getInitializedMarketCount() external view returns (uint256) {
        return _initializedMarkets.length;
    }

    /// @notice Validate market parameters.
    /// @param params params used by this operation.
    /// @return True when the requested condition is met.
    /// @dev Access: No caller-specific access restriction is imposed.
    function validateParameters(MarketParameters calldata params)
        external
        pure
        returns (bool)
    {
        _validateParameters(params);
        return true;
    }

    // -------------------------------------------------------------------------
    // Internal functions
    // -------------------------------------------------------------------------

    /// @notice Validate market parameters.
    function _validateParameters(MarketParameters calldata params) internal pure {
        if (params.collateralToken == address(0)) revert ZeroCollateralToken();
        if (params.resolutionDeadline <= block.timestamp) revert InvalidDeadline();
        if (params.minLiquidity == 0) revert ZeroMinLiquidity();
        if (bytes(params.metadataURI).length == 0) revert EmptyMetadataURI();
    }
}
