// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PositionToken.sol";

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

    /// @notice Returns the creator of a registered market, or address(0) if unregistered.
    function getCreator(address market) external view returns (address) {
        return _markets[market].creator;
    }

    /// @notice Returns the full MarketInfo for a registered market.
    function getMarketInfo(address market) external view returns (MarketInfo memory) {
        return _markets[market];
    }
}
