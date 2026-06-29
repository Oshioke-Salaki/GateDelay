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

    // -------------------------------------------------------------------------
    // External functions
    // -------------------------------------------------------------------------

    /// @notice Initialize a market with parameters.
    /// @param market Market address to initialize.
    /// @param params Market parameters.
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
    function activateMarket(address market) external {
        MarketState storage state = _marketState[market];
        if (!state.initialized) revert InitializationFailed();
        if (state.status != MarketStatus.INITIALIZED) revert InvalidMarketParameters();

        state.status = MarketStatus.ACTIVE;
        emit MarketActivated(market);
        emit InitializationStatusChanged(market, MarketStatus.ACTIVE);
    }

    /// @notice Set market liquidity.
    /// @param market Market address.
    /// @param liquidity Total liquidity amount.
    function setMarketLiquidity(address market, uint256 liquidity) external {
        MarketState storage state = _marketState[market];
        if (!state.initialized) revert InitializationFailed();

        state.totalLiquidity = liquidity;
    }

    // -------------------------------------------------------------------------
    // Query functions
    // -------------------------------------------------------------------------

    /// @notice Get market parameters.
    function getMarketParameters(address market)
        external
        view
        returns (MarketParameters memory)
    {
        return _marketParameters[market];
    }

    /// @notice Get market state.
    function getMarketState(address market)
        external
        view
        returns (MarketState memory)
    {
        return _marketState[market];
    }

    /// @notice Check if market is initialized.
    function isInitialized(address market) external view returns (bool) {
        return _marketState[market].initialized;
    }

    /// @notice Get market status.
    function getMarketStatus(address market)
        external
        view
        returns (MarketStatus)
    {
        return _marketState[market].status;
    }

    /// @notice Get initialization timestamp.
    function getInitializationTimestamp(address market)
        external
        view
        returns (uint256)
    {
        return _initializationTimestamp[market];
    }

    /// @notice Get all initialized markets.
    function getInitializedMarkets() external view returns (address[] memory) {
        return _initializedMarkets;
    }

    /// @notice Get initialized market count.
    function getInitializedMarketCount() external view returns (uint256) {
        return _initializedMarkets.length;
    }

    /// @notice Validate market parameters.
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
