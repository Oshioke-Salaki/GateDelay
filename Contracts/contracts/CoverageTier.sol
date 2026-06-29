// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title  CoverageTier
 * @notice Tiered coverage subscription system.
 *
 * The owner defines tiers (e.g. BASIC, STANDARD, PREMIUM) each with a price
 * and a set of benefit flags. Users subscribe to a tier by paying the price in
 * the payment token. Upgrades are supported; the user pays only the price
 * difference. Subscriptions are tracked with start/expiry timestamps.
 */
contract CoverageTier is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Errors ─────────────────────────────────────────────────────────────────
    error ZeroAddress();
    error ZeroAmount();
    error TierNotFound();
    error TierInactive();
    error AlreadyOnHigherTier();
    error SameTier();
    error SubscriptionNotFound();
    error InvalidDuration();

    // ── Types ──────────────────────────────────────────────────────────────────

    struct Tier {
        string   name;
        uint256  price;          // cost in payment token per subscription period
        uint256  duration;       // subscription duration in seconds
        bytes32  benefits;       // packed benefit flags (application-defined bitmask)
        bool     active;
        uint256  subscriberCount;
    }

    struct Subscription {
        bytes32  tierId;
        uint256  startTime;
        uint256  expiryTime;
        bool     active;
    }

    // ── Events ─────────────────────────────────────────────────────────────────
    event TierDefined(bytes32 indexed tierId, string name, uint256 price, uint256 duration);
    event TierDeactivated(bytes32 indexed tierId);
    event TierPriceUpdated(bytes32 indexed tierId, uint256 newPrice);
    event Subscribed(address indexed user, bytes32 indexed tierId, uint256 expiryTime);
    event Upgraded(address indexed user, bytes32 indexed fromTier, bytes32 indexed toTier, uint256 expiryTime);
    event SubscriptionRenewed(address indexed user, bytes32 indexed tierId, uint256 newExpiry);

    // ── State ──────────────────────────────────────────────────────────────────

    IERC20 public immutable paymentToken;
    address public treasury;

    mapping(bytes32 => Tier) public tiers;
    bytes32[] public tierIds;

    mapping(address => Subscription) public subscriptions;

    // ── Constructor ────────────────────────────────────────────────────────────

    constructor(address _paymentToken, address _treasury) Ownable(msg.sender) {
        if (_paymentToken == address(0) || _treasury == address(0)) revert ZeroAddress();
        paymentToken = IERC20(_paymentToken);
        treasury = _treasury;
    }

    // ── Admin ──────────────────────────────────────────────────────────────────

    /**
     * @notice Define or update a coverage tier.
     * @param tierId    Arbitrary identifier (e.g. keccak256("PREMIUM")).
     * @param name      Human-readable name.
     * @param price     Cost in payment token.
     * @param duration  Subscription duration in seconds.
     * @param benefits  Packed benefit flags.
     */
    function defineTier(
        bytes32 tierId,
        string calldata name,
        uint256 price,
        uint256 duration,
        bytes32 benefits
    ) external onlyOwner {
        if (duration == 0) revert InvalidDuration();
        bool isNew = !tiers[tierId].active && tiers[tierId].price == 0;
        tiers[tierId] = Tier({
            name: name,
            price: price,
            duration: duration,
            benefits: benefits,
            active: true,
            subscriberCount: tiers[tierId].subscriberCount
        });
        if (isNew) tierIds.push(tierId);
        emit TierDefined(tierId, name, price, duration);
    }

    function deactivateTier(bytes32 tierId) external onlyOwner {
        if (!tiers[tierId].active) revert TierNotFound();
        tiers[tierId].active = false;
        emit TierDeactivated(tierId);
    }

    function updateTierPrice(bytes32 tierId, uint256 newPrice) external onlyOwner {
        if (!tiers[tierId].active) revert TierNotFound();
        tiers[tierId].price = newPrice;
        emit TierPriceUpdated(tierId, newPrice);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        treasury = newTreasury;
    }

    // ── Subscriptions ──────────────────────────────────────────────────────────

    /// @notice Subscribe to a tier. Reverts if user already has an active subscription.
    function subscribe(bytes32 tierId) external nonReentrant {
        Tier storage tier = tiers[tierId];
        if (!tier.active) revert TierInactive();

        Subscription storage sub = subscriptions[msg.sender];
        // Allow re-subscribe only if expired
        if (sub.active && block.timestamp < sub.expiryTime) revert AlreadyOnHigherTier();

        if (tier.price > 0) {
            paymentToken.safeTransferFrom(msg.sender, treasury, tier.price);
        }

        if (!sub.active) tier.subscriberCount += 1;

        uint256 expiry = block.timestamp + tier.duration;
        subscriptions[msg.sender] = Subscription({
            tierId: tierId,
            startTime: block.timestamp,
            expiryTime: expiry,
            active: true
        });

        emit Subscribed(msg.sender, tierId, expiry);
    }

    /**
     * @notice Upgrade to a higher-priced tier. User pays the price difference.
     * @param newTierId  Target tier (must have a higher price than current).
     */
    function upgrade(bytes32 newTierId) external nonReentrant {
        Subscription storage sub = subscriptions[msg.sender];
        if (!sub.active) revert SubscriptionNotFound();

        Tier storage currentTier = tiers[sub.tierId];
        Tier storage newTier     = tiers[newTierId];

        if (!newTier.active) revert TierInactive();
        if (sub.tierId == newTierId) revert SameTier();
        if (newTier.price <= currentTier.price) revert AlreadyOnHigherTier();

        uint256 priceDiff = newTier.price - currentTier.price;
        if (priceDiff > 0) {
            paymentToken.safeTransferFrom(msg.sender, treasury, priceDiff);
        }

        bytes32 fromTier = sub.tierId;
        uint256 expiry   = block.timestamp + newTier.duration;

        sub.tierId    = newTierId;
        sub.startTime = block.timestamp;
        sub.expiryTime = expiry;

        emit Upgraded(msg.sender, fromTier, newTierId, expiry);
    }

    /// @notice Renew an existing subscription for another full period.
    function renew(bytes32 tierId) external nonReentrant {
        Tier storage tier = tiers[tierId];
        if (!tier.active) revert TierInactive();

        Subscription storage sub = subscriptions[msg.sender];
        if (!sub.active || sub.tierId != tierId) revert SubscriptionNotFound();

        if (tier.price > 0) {
            paymentToken.safeTransferFrom(msg.sender, treasury, tier.price);
        }

        // Extend from current expiry if still active, otherwise from now
        uint256 base = block.timestamp > sub.expiryTime ? block.timestamp : sub.expiryTime;
        sub.expiryTime = base + tier.duration;

        emit SubscriptionRenewed(msg.sender, tierId, sub.expiryTime);
    }

    // ── Queries ────────────────────────────────────────────────────────────────

    /// @notice Returns whether a user has an active (non-expired) subscription.
    function isSubscribed(address user) external view returns (bool) {
        Subscription storage sub = subscriptions[user];
        return sub.active && block.timestamp < sub.expiryTime;
    }

    /// @notice Returns the user's current subscription details.
    function getSubscription(address user) external view returns (Subscription memory) {
        return subscriptions[user];
    }

    /// @notice Returns tier details.
    function getTier(bytes32 tierId) external view returns (Tier memory) {
        return tiers[tierId];
    }

    /// @notice Returns all registered tier IDs.
    function getTierIds() external view returns (bytes32[] memory) {
        return tierIds;
    }

    /// @notice Returns whether a user's subscription has a specific benefit flag set.
    function hasBenefit(address user, bytes32 benefitFlag) external view returns (bool) {
        Subscription storage sub = subscriptions[user];
        if (!sub.active || block.timestamp >= sub.expiryTime) return false;
        return (tiers[sub.tierId].benefits & benefitFlag) != 0;
    }
}
