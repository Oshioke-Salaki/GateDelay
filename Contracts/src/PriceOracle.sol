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

    // ── Types ──────────────────────────────────────────────────────────────────

    struct FeedData {
        int256  price;          // latest price (18-decimal fixed-point)
        uint256 updatedAt;      // timestamp of last update
        uint256 maxStaleness;   // max seconds before price is considered stale
        bool    active;         // whether this feed is active
        string  description;    // human-readable label (e.g. "ETH/USD")
    }

    // ── Events ─────────────────────────────────────────────────────────────────
    event FeedRegistered(bytes32 indexed feedId, string description, uint256 maxStaleness);
    event FeedDeactivated(bytes32 indexed feedId);
    event PriceUpdated(bytes32 indexed feedId, int256 price, uint256 timestamp);
    event FallbackSet(bytes32 indexed primaryFeedId, bytes32 indexed fallbackFeedId);
    event UpdaterSet(address indexed updater, bool approved);

    // ── State ──────────────────────────────────────────────────────────────────

    /// @notice Feed data keyed by feedId
    mapping(bytes32 => FeedData) public feeds;

    /// @notice Primary → fallback feed mapping
    mapping(bytes32 => bytes32) public fallbackFeed;

    /// @notice Addresses authorised to push price updates
    mapping(address => bool) public isUpdater;

    // ── Modifiers ──────────────────────────────────────────────────────────────

    modifier onlyUpdater() {
        if (!isUpdater[msg.sender] && msg.sender != owner()) revert NotAuthorizedUpdater();
        _;
    }

    modifier feedExists(bytes32 feedId) {
        if (!feeds[feedId].active) revert FeedNotRegistered();
        _;
    }

    // ── Constructor ────────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {
        isUpdater[msg.sender] = true;
    }

    // ── Admin ──────────────────────────────────────────────────────────────────

    /// @notice Register a new price feed.
    /// @param feedId       Unique identifier (e.g. keccak256("ETH/USD")).
    /// @param description  Human-readable label.
    /// @param maxStaleness Maximum age in seconds before the price is stale.
    function registerFeed(bytes32 feedId, string calldata description, uint256 maxStaleness) external onlyOwner {
        if (feeds[feedId].active) revert FeedAlreadyRegistered();
        feeds[feedId] = FeedData({
            price: 0,
            updatedAt: 0,
            maxStaleness: maxStaleness,
            active: true,
            description: description
        });
        emit FeedRegistered(feedId, description, maxStaleness);
    }

    /// @notice Deactivate a feed.
    function deactivateFeed(bytes32 feedId) external onlyOwner feedExists(feedId) {
        feeds[feedId].active = false;
        emit FeedDeactivated(feedId);
    }

    /// @notice Set a fallback feed for a primary feed.
    function setFallback(bytes32 primaryFeedId, bytes32 fallbackFeedId) external onlyOwner {
        if (!feeds[primaryFeedId].active) revert FeedNotRegistered();
        if (!feeds[fallbackFeedId].active) revert FeedNotRegistered();
        fallbackFeed[primaryFeedId] = fallbackFeedId;
        emit FallbackSet(primaryFeedId, fallbackFeedId);
    }

    /// @notice Approve or revoke a price updater.
    function setUpdater(address updater, bool approved) external onlyOwner {
        if (updater == address(0)) revert ZeroAddress();
        isUpdater[updater] = approved;
        emit UpdaterSet(updater, approved);
    }

    // ── Price updates ──────────────────────────────────────────────────────────

    /// @notice Push a new price for a feed.
    /// @param feedId  The feed to update.
    /// @param price   New price value (must be > 0).
    function updatePrice(bytes32 feedId, int256 price) external onlyUpdater feedExists(feedId) {
        if (price <= 0) revert InvalidPrice();
        feeds[feedId].price = price;
        feeds[feedId].updatedAt = block.timestamp;
        emit PriceUpdated(feedId, price, block.timestamp);
    }

    // ── Price queries ──────────────────────────────────────────────────────────

    /// @notice Returns the latest valid price for a feed, falling back if primary is stale.
    /// @param feedId  The primary feed to query.
    /// @return price      The latest valid price.
    /// @return updatedAt  Timestamp of the price.
    function getPrice(bytes32 feedId) external view returns (int256 price, uint256 updatedAt) {
        (price, updatedAt) = _resolvePrice(feedId);
    }

    /// @notice Returns the latest price without reverting on staleness (caller must validate).
    function getRawPrice(bytes32 feedId) external view feedExists(feedId) returns (int256, uint256) {
        FeedData storage f = feeds[feedId];
        return (f.price, f.updatedAt);
    }

    /// @notice Returns true if the feed has a fresh, valid price.
    function isFeedHealthy(bytes32 feedId) external view returns (bool) {
        if (!feeds[feedId].active) return false;
        FeedData storage f = feeds[feedId];
        return f.updatedAt > 0 && block.timestamp - f.updatedAt <= f.maxStaleness && f.price > 0;
    }

    /// @notice Returns feed metadata.
    function getFeedInfo(bytes32 feedId) external view returns (FeedData memory) {
        return feeds[feedId];
    }

    // ── Internal ───────────────────────────────────────────────────────────────

    function _resolvePrice(bytes32 feedId) internal view returns (int256 price, uint256 updatedAt) {
        if (!feeds[feedId].active) revert FeedNotRegistered();

        FeedData storage primary = feeds[feedId];
        if (_isFresh(primary)) {
            return (primary.price, primary.updatedAt);
        }

        // Try fallback
        bytes32 fb = fallbackFeed[feedId];
        if (fb != bytes32(0) && feeds[fb].active) {
            FeedData storage fallback = feeds[fb];
            if (_isFresh(fallback)) {
                return (fallback.price, fallback.updatedAt);
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
