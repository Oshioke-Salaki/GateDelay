// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title PriceOracle
/// @notice Aggregates price data from multiple oracle feeds with fallback support.
/// @dev Designed to be feed-agnostic; integrators push prices via `updatePrice`.
///      For production use, authorised updaters would be Chainlink / API3 adapters.
contract PriceOracle is Ownable {
    // ── Errors ─────────────────────────────────────────────────────────────────
    error ZeroAddress();
    error InvalidPrice();
    error StalePrice();
    error NoValidPrice();
    error FeedNotRegistered();
    error FeedAlreadyRegistered();
    error NotAuthorizedUpdater();
    error ZeroFeedId();
    error InvalidFeedMetadata();
    error FeedMetadataMissing();
    error IncompatibleFallback();
    error InvalidTimestamp();
    error FutureTimestamp();
    error SourceTimestampNotIncreasing();
    error RoundIdNotIncreasing();

    // ── Types ──────────────────────────────────────────────────────────────────

    struct FeedData {
        int256  price;          // latest price in the registered feed's units
        uint256 updatedAt;      // timestamp of last update
        bytes32 baseAsset;      // machine-readable base asset identifier
        bytes32 quoteAsset;     // machine-readable quote asset identifier
        uint8   decimals;       // decimals used to scale this feed's prices
        uint80  roundId;        // latest source round identifier
        uint256 receivedAt;     // timestamp when the update was received
        uint256 maxStaleness;   // max seconds before price is considered stale
        bool    active;         // whether this feed is active
        string  description;    // human-readable label (e.g. "ETH/USD")
    }

    // ── Events ─────────────────────────────────────────────────────────────────
    event FeedRegistered(bytes32 indexed feedId, string description, uint256 maxStaleness);
    event FeedMetadataRegistered(
        bytes32 indexed feedId,
        bytes32 indexed baseAsset,
        bytes32 indexed quoteAsset,
        uint8 decimals
    );
    event FeedDeactivated(bytes32 indexed feedId);
    event PriceUpdated(
        bytes32 indexed feedId,
        int256 price,
        uint256 sourceTimestamp,
        uint80 roundId,
        uint256 receivedAt
    );
    event FallbackSet(bytes32 indexed primaryFeedId, bytes32 indexed fallbackFeedId);
    event UpdaterSet(bytes32 indexed feedId, address indexed updater, bool approved);

    // ── State ──────────────────────────────────────────────────────────────────

    /// @notice Feed data keyed by feedId
    mapping(bytes32 => FeedData) public feeds;

    /// @notice Primary → fallback feed mapping
    mapping(bytes32 => bytes32) public fallbackFeed;

    /// @notice Feed-specific authorization for price updaters
    mapping(bytes32 => mapping(address => bool)) public isUpdater;

    // ── Modifiers ──────────────────────────────────────────────────────────────

    modifier onlyUpdater(bytes32 feedId) {
        if (!isUpdater[feedId][msg.sender] && msg.sender != owner()) revert NotAuthorizedUpdater();
        _;
    }

    modifier feedExists(bytes32 feedId) {
        if (!feeds[feedId].active) revert FeedNotRegistered();
        _;
    }

    // ── Constructor ────────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ── Admin ──────────────────────────────────────────────────────────────────

    /// @notice Register a feed without fallback-compatible identity metadata.
    /// @param feedId       Unique identifier (e.g. keccak256("ETH/USD")).
    /// @param description  Human-readable label.
    /// @param maxStaleness Maximum age in seconds before the price is stale.
    /// @dev Feeds registered without identity metadata cannot be configured as fallbacks.
    ///      The zero feed ID is reserved. Only the owner may register feeds.
    function registerFeed(bytes32 feedId, string calldata description, uint256 maxStaleness) external onlyOwner {
        _registerFeed(feedId, description, maxStaleness, bytes32(0), bytes32(0), 0);
    }

    /// @notice Register a feed with machine-readable identity and price scale.
    /// @param feedId       Unique identifier for the feed.
    /// @param description  Human-readable label.
    /// @param maxStaleness Maximum age in seconds before the price is stale.
    /// @param baseAsset    Machine-readable identifier for the base asset.
    /// @param quoteAsset   Machine-readable identifier for the quote asset.
    /// @param decimals     Decimal scale used by reported prices.
    function registerFeed(
        bytes32 feedId,
        string calldata description,
        uint256 maxStaleness,
        bytes32 baseAsset,
        bytes32 quoteAsset,
        uint8 decimals
    ) external onlyOwner {
        if (baseAsset == bytes32(0) || quoteAsset == bytes32(0)) revert InvalidFeedMetadata();
        _registerFeed(feedId, description, maxStaleness, baseAsset, quoteAsset, decimals);
        emit FeedMetadataRegistered(feedId, baseAsset, quoteAsset, decimals);
    }

    /// @notice Deactivate a feed.
    /// @param feedId Identifier of the relevant feed.
    /// @dev Access: Caller must be the contract owner.
    function deactivateFeed(bytes32 feedId) external onlyOwner feedExists(feedId) {
        feeds[feedId].active = false;
        emit FeedDeactivated(feedId);
    }

    /// @notice Set a fallback feed for a primary feed.
    /// @param primaryFeedId Identifier of the relevant primary feed.
    /// @param fallbackFeedId Identifier of the relevant fallback feed.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `FeedNotRegistered` if `!feeds[primaryFeedId].active` is true.
    ///     `FeedNotRegistered` if `!feeds[fallbackFeedId].active` is true.
    ///     `FeedMetadataMissing` if either feed lacks identity metadata.
    ///     `IncompatibleFallback` if the asset pair or decimal scale differs.
    function setFallback(bytes32 primaryFeedId, bytes32 fallbackFeedId) external onlyOwner {
        if (primaryFeedId == bytes32(0) || fallbackFeedId == bytes32(0)) revert ZeroFeedId();
        if (!feeds[primaryFeedId].active) revert FeedNotRegistered();
        if (!feeds[fallbackFeedId].active) revert FeedNotRegistered();

        FeedData storage primary = feeds[primaryFeedId];
        FeedData storage fallbackData = feeds[fallbackFeedId];
        if (primary.baseAsset == bytes32(0) || primary.quoteAsset == bytes32(0)
            || fallbackData.baseAsset == bytes32(0) || fallbackData.quoteAsset == bytes32(0)) {
            revert FeedMetadataMissing();
        }
        if (
            primary.baseAsset != fallbackData.baseAsset || primary.quoteAsset != fallbackData.quoteAsset
                || primary.decimals != fallbackData.decimals
        ) {
            revert IncompatibleFallback();
        }

        fallbackFeed[primaryFeedId] = fallbackFeedId;
        emit FallbackSet(primaryFeedId, fallbackFeedId);
    }

    /// @notice Approve or revoke an updater for one active feed.
    /// @param feedId Feed the updater may update.
    /// @param updater Address associated with updater.
    /// @param approved Whether approved is enabled or selected.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `FeedNotRegistered` for an inactive feed or `ZeroAddress`
    ///     if `updater == address(0)`.
    function setUpdater(bytes32 feedId, address updater, bool approved) external onlyOwner feedExists(feedId) {
        if (updater == address(0)) revert ZeroAddress();
        isUpdater[feedId][updater] = approved;
        emit UpdaterSet(feedId, updater, approved);
    }

    // ── Price updates ──────────────────────────────────────────────────────────

    /// @notice Push a price using the receipt time and the next local round.
    /// @dev Compatibility API for direct observations. Adapters reporting source observations
    ///      must use the timestamp/round overload so stale observations cannot be refreshed.
    function updatePrice(bytes32 feedId, int256 price) external onlyUpdater(feedId) feedExists(feedId) {
        _updatePrice(feedId, price, block.timestamp, feeds[feedId].roundId + 1);
    }

    /// @notice Push a source observation with its original timestamp and round identifier.
    /// @param feedId The registered feed to update.
    /// @param price Positive price in the feed's registered units.
    /// @param sourceTimestamp Timestamp at which the source observed the price.
    /// @param roundId Strictly increasing source round identifier.
    function updatePrice(bytes32 feedId, int256 price, uint256 sourceTimestamp, uint80 roundId)
        external onlyUpdater(feedId) feedExists(feedId)
    {
        _updatePrice(feedId, price, sourceTimestamp, roundId);
    }

    function _updatePrice(bytes32 feedId, int256 price, uint256 sourceTimestamp, uint80 roundId) private {
        if (price <= 0) revert InvalidPrice();
        if (sourceTimestamp == 0) revert InvalidTimestamp();
        if (sourceTimestamp > block.timestamp) revert FutureTimestamp();

        FeedData storage feed = feeds[feedId];
        if (sourceTimestamp <= feed.updatedAt) revert SourceTimestampNotIncreasing();
        if (roundId == 0 || roundId <= feed.roundId) revert RoundIdNotIncreasing();

        feed.price = price;
        feed.updatedAt = sourceTimestamp;
        feed.roundId = roundId;
        feed.receivedAt = block.timestamp;
        emit PriceUpdated(feedId, price, sourceTimestamp, roundId, feed.receivedAt);
    }

    // ── Price queries ──────────────────────────────────────────────────────────

    /// @notice Returns the latest valid price for a feed, falling back if primary is stale.
    /// @param feedId  The primary feed to query.
    /// @return price      The latest valid price.
    /// @return updatedAt  Source observation timestamp of the price.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getPrice(bytes32 feedId) external view returns (int256 price, uint256 updatedAt) {
        (price, updatedAt) = _resolvePrice(feedId);
    }

    /// @notice Returns the latest price without reverting on staleness (caller must validate).
    /// @param feedId Identifier of the relevant feed.
    /// @return price Latest stored price.
    /// @return updatedAt Source observation timestamp of the price.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getRawPrice(bytes32 feedId) external view feedExists(feedId) returns (int256, uint256) {
        FeedData storage f = feeds[feedId];
        return (f.price, f.updatedAt);
    }

    /// @notice Returns true if the feed has a fresh, valid price.
    /// @param feedId Identifier of the relevant feed.
    /// @return True when the requested condition is met.
    /// @dev Access: No caller-specific access restriction is imposed.
    function isFeedHealthy(bytes32 feedId) external view returns (bool) {
        if (!feeds[feedId].active) return false;
        FeedData storage f = feeds[feedId];
        return f.updatedAt > 0 && block.timestamp - f.updatedAt <= f.maxStaleness && f.price > 0;
    }

    /// @notice Returns feed metadata.
    /// @param feedId Identifier of the relevant feed.
    /// @return Feed info returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getFeedInfo(bytes32 feedId) external view returns (FeedData memory) {
        return feeds[feedId];
    }

    // ── Internal ───────────────────────────────────────────────────────────────

    function _registerFeed(
        bytes32 feedId,
        string calldata description,
        uint256 maxStaleness,
        bytes32 baseAsset,
        bytes32 quoteAsset,
        uint8 decimals
    ) private {
        if (feedId == bytes32(0)) revert ZeroFeedId();
        if (feeds[feedId].active) revert FeedAlreadyRegistered();
        feeds[feedId] = FeedData({
            price: 0,
            updatedAt: 0,
            roundId: 0,
            receivedAt: 0,
            baseAsset: baseAsset,
            quoteAsset: quoteAsset,
            decimals: decimals,
            maxStaleness: maxStaleness,
            active: true,
            description: description
        });
        emit FeedRegistered(feedId, description, maxStaleness);
    }

    function _resolvePrice(bytes32 feedId) internal view returns (int256 price, uint256 updatedAt) {
        if (!feeds[feedId].active) revert FeedNotRegistered();

        FeedData storage primary = feeds[feedId];
        if (_isFresh(primary)) {
            return (primary.price, primary.updatedAt);
        }

        // Try fallback feed
        bytes32 fb = fallbackFeed[feedId];
        if (fb != bytes32(0) && feeds[fb].active) {
            FeedData storage fallbackFeedData = feeds[fb];
            if (_isFresh(fallbackFeedData)) {
                return (fallbackFeedData.price, fallbackFeedData.updatedAt);
            }
        }

        revert NoValidPrice();
    }

    function _isFresh(FeedData storage f) internal view returns (bool) {
        return f.updatedAt > 0
            && f.price > 0
            && block.timestamp - f.updatedAt <= f.maxStaleness;
    }
}
