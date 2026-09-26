// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PositionToken} from "./PositionToken.sol";

/// @title MarketFactory
/// @notice Deploys and registers prediction market instances.
contract MarketFactory {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error ZeroCollateralToken();
    error InvalidDeadline();
    error ZeroMinLiquidity();
    error EmptyMetadataURI();
    error ZeroPositionToken();
    error InvalidPositionToken();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    enum MarketStatus { OPEN, PAUSED, RESOLVED, DISPUTED, CANCELLED }

    struct MarketInfo {
        address creator;
        address collateralToken;
        uint256 resolutionDeadline;
        uint256 minLiquidity;
        string metadataURI;
        MarketStatus status;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event MarketCreated(
        address indexed market,
        address indexed creator,
        address indexed collateralToken,
        uint256 resolutionDeadline
    );

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    PositionToken public immutable positionToken;

    /// @dev market address => MarketInfo
    mapping(address => MarketInfo) private _markets;

    /// @dev all registered market addresses
    address[] private _marketList;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(address _positionToken) {
        if (_positionToken == address(0)) revert ZeroPositionToken();
        if (_positionToken.code.length == 0) revert InvalidPositionToken();
        positionToken = PositionToken(_positionToken);
    }

    // -------------------------------------------------------------------------
    // External functions
    // -------------------------------------------------------------------------

    /// @notice Create and register a new prediction market.
    /// @param collateralToken  ERC20 token used as collateral (must be non-zero).
    /// @param resolutionDeadline  Unix timestamp strictly greater than block.timestamp.
    /// @param minLiquidity  Minimum liquidity required (must be > 0).
    /// @param metadataURI  Non-empty metadata URI string.
    /// @return market  Deterministic address representing the new market.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `ZeroCollateralToken` if `collateralToken == address(0)` is true.
    ///     `InvalidDeadline` if `resolutionDeadline <= block.timestamp` is true. `ZeroMinLiquidity`
    ///     if `minLiquidity == 0` is true. `EmptyMetadataURI` if `bytes(metadataURI).length == 0`
    ///     is true.
    function createMarket(
        address collateralToken,
        uint256 resolutionDeadline,
        uint256 minLiquidity,
        string calldata metadataURI
    ) external returns (address market) {
        if (collateralToken == address(0)) revert ZeroCollateralToken();
        if (resolutionDeadline <= block.timestamp) revert InvalidDeadline();
        if (minLiquidity == 0) revert ZeroMinLiquidity();
        if (bytes(metadataURI).length == 0) revert EmptyMetadataURI();

        // Derive a deterministic market address from caller + timestamp + list length
        market = address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(msg.sender, block.timestamp, _marketList.length)
                    )
                )
            )
        );

        _markets[market] = MarketInfo({
            creator: msg.sender,
            collateralToken: collateralToken,
            resolutionDeadline: resolutionDeadline,
            minLiquidity: minLiquidity,
            metadataURI: metadataURI,
            status: MarketStatus.OPEN
        });

        _marketList.push(market);

        // Authorise the new market address to mint/burn position tokens
        positionToken.authorise(market);

        emit MarketCreated(market, msg.sender, collateralToken, resolutionDeadline);
    }

    /// @notice Returns the number of registered markets.
    /// @return Market count returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getMarketCount() external view returns (uint256) {
        return _marketList.length;
    }

    /// @notice Returns all registered market addresses.
    /// @return Markets returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getMarkets() external view returns (address[] memory) {
        return _marketList;
    }

    /// @notice Returns a registered market address by index.
    /// @param index Numeric index used by this operation.
    /// @return Market at returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getMarketAt(uint256 index) external view returns (address) {
        return _marketList[index];
    }

    /// @notice Returns whether an address is a registered market.
    /// @param market Market address associated with this operation.
    /// @return True when the requested condition is met.
    /// @dev Access: No caller-specific access restriction is imposed.
    function isRegisteredMarket(address market) external view returns (bool) {
        return _markets[market].creator != address(0);
    }

    /// @notice Executes marketCount.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function marketCount() external view returns (uint256) {
        return _marketList.length;
    }

    /// @notice Returns a registered market address by index.
    /// @param index Numeric index used by this operation.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function marketAt(uint256 index) external view returns (address) {
        return _marketList[index];
    }

    /// @notice Returns the creator of a registered market, or address(0) if unregistered.
    /// @param market Market address associated with this operation.
    /// @return Creator returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getCreator(address market) external view returns (address) {
        return _markets[market].creator;
    }

    /// @notice Returns the full MarketInfo for a registered market.
    /// @param market Market address associated with this operation.
    /// @return Market info returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getMarketInfo(address market) external view returns (MarketInfo memory) {
        return _markets[market];
    }
}
