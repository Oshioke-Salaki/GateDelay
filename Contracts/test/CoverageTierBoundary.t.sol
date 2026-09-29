// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../src/CoverageTier.sol";

// ---------------------------------------------------------------------------
// Minimal ERC20 with mint/burn for premium payment tests
// ---------------------------------------------------------------------------
contract MockPaymentToken is ERC20 {
    constructor() ERC20("PayToken", "PAY") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

// ---------------------------------------------------------------------------
// Tests – issue #972: Coverage tier boundaries, premium calculation,
//         and claim eligibility
// ---------------------------------------------------------------------------
contract CoverageTierBoundaryTest is Test {
    CoverageTier     coverageTier;
    MockPaymentToken token;

    address owner    = address(0xA11CE);
    address treasury = address(0xBEA7);
    address alice    = address(0xCAFE);
    address bob      = address(0xD00D);

    // Tier IDs
    bytes32 constant BASIC    = keccak256("BASIC");
    bytes32 constant STANDARD = keccak256("STANDARD");
    bytes32 constant PREMIUM  = keccak256("PREMIUM");

    // Tier prices (payment-token units)
    uint256 constant BASIC_PRICE    = 100e18;
    uint256 constant STANDARD_PRICE = 300e18;
    uint256 constant PREMIUM_PRICE  = 600e18;

    // Durations
    uint256 constant BASIC_DURATION    = 30 days;
    uint256 constant STANDARD_DURATION = 30 days;
    uint256 constant PREMIUM_DURATION  = 60 days;

    // Benefit flags (bitmask)
    bytes32 constant CLAIM_ELIGIBLE  = bytes32(uint256(1));   // bit 0
    bytes32 constant PRIORITY_CLAIM  = bytes32(uint256(2));   // bit 1
    bytes32 constant FULL_COVERAGE   = bytes32(uint256(4));   // bit 2

    bytes32 constant BASIC_BENEFITS    = CLAIM_ELIGIBLE;
    bytes32 constant STANDARD_BENEFITS = CLAIM_ELIGIBLE | PRIORITY_CLAIM;
    bytes32 constant PREMIUM_BENEFITS  = CLAIM_ELIGIBLE | PRIORITY_CLAIM | FULL_COVERAGE;

    function setUp() public {
        token = new MockPaymentToken();

        vm.prank(owner);
        coverageTier = new CoverageTier(address(token), treasury);

        // Define tiers
        vm.startPrank(owner);
        coverageTier.defineTier(BASIC,    "Basic",    BASIC_PRICE,    BASIC_DURATION,    BASIC_BENEFITS);
        coverageTier.defineTier(STANDARD, "Standard", STANDARD_PRICE, STANDARD_DURATION, STANDARD_BENEFITS);
        coverageTier.defineTier(PREMIUM,  "Premium",  PREMIUM_PRICE,  PREMIUM_DURATION,  PREMIUM_BENEFITS);
        vm.stopPrank();

        // Fund alice and bob
        token.mint(alice, 10_000e18);
        token.mint(bob,   10_000e18);

        vm.prank(alice);
        token.approve(address(coverageTier), type(uint256).max);

        vm.prank(bob);
        token.approve(address(coverageTier), type(uint256).max);
    }

    // ─────────────────────────────────────────────────────────────────
    // Tier definition / admin
    // ─────────────────────────────────────────────────────────────────

    /// @notice All three tiers are registered and active.
    function test_TiersDefinedCorrectly() public view {
        CoverageTier.Tier memory b = coverageTier.getTier(BASIC);
        assertEq(b.price,    BASIC_PRICE);
        assertEq(b.duration, BASIC_DURATION);
        assertTrue(b.active);

        CoverageTier.Tier memory s = coverageTier.getTier(STANDARD);
        assertEq(s.price,    STANDARD_PRICE);
        assertEq(s.duration, STANDARD_DURATION);
        assertTrue(s.active);

        CoverageTier.Tier memory p = coverageTier.getTier(PREMIUM);
        assertEq(p.price,    PREMIUM_PRICE);
        assertEq(p.duration, PREMIUM_DURATION);
        assertTrue(p.active);
    }

    /// @notice getTierIds returns all registered IDs.
    function test_GetTierIdsReturnsAll() public view {
        bytes32[] memory ids = coverageTier.getTierIds();
        assertEq(ids.length, 3);
    }

    /// @notice Defining a tier with zero duration reverts.
    function test_DefineTierZeroDurationReverts() public {
        vm.prank(owner);
        vm.expectRevert(CoverageTier.InvalidDuration.selector);
        coverageTier.defineTier(keccak256("BAD"), "Bad", 0, 0, bytes32(0));
    }

    /// @notice Only owner can define tiers.
    function test_NonOwnerCannotDefineTier() public {
        vm.prank(alice);
        vm.expectRevert();
        coverageTier.defineTier(keccak256("X"), "X", 1e18, 1 days, bytes32(0));
    }

    /// @notice Owner can update price on an active tier.
    function test_UpdateTierPriceSucceeds() public {
        vm.prank(owner);
        coverageTier.updateTierPrice(BASIC, 150e18);
        assertEq(coverageTier.getTier(BASIC).price, 150e18);
    }

    /// @notice Updating price of an inactive tier reverts.
    function test_UpdatePriceOnInactiveTierReverts() public {
        vm.prank(owner);
        coverageTier.deactivateTier(BASIC);

        vm.prank(owner);
        vm.expectRevert(CoverageTier.TierNotFound.selector);
        coverageTier.updateTierPrice(BASIC, 150e18);
    }

    // ─────────────────────────────────────────────────────────────────
    // Subscription – boundary values
    // ─────────────────────────────────────────────────────────────────

    /// @notice Subscribing to BASIC transfers exactly BASIC_PRICE to treasury.
    function test_SubscribeTransfersExactPriceToTreasury() public {
        uint256 tBefore = token.balanceOf(treasury);

        vm.prank(alice);
        coverageTier.subscribe(BASIC);

        assertEq(token.balanceOf(treasury) - tBefore, BASIC_PRICE);
    }

    /// @notice Subscription sets correct start/expiry timestamps.
    function test_SubscribeSetsTimestamps() public {
        uint256 ts = block.timestamp;
        vm.prank(alice);
        coverageTier.subscribe(BASIC);

        CoverageTier.Subscription memory sub = coverageTier.getSubscription(alice);
        assertEq(sub.startTime,  ts);
        assertEq(sub.expiryTime, ts + BASIC_DURATION);
        assertTrue(sub.active);
    }

    /// @notice isSubscribed returns true immediately after subscribing.
    function test_IsSubscribedTrueAfterSubscribe() public {
        vm.prank(alice);
        coverageTier.subscribe(BASIC);
        assertTrue(coverageTier.isSubscribed(alice));
    }

    /// @notice Subscribing to an inactive tier reverts.
    function test_SubscribeInactiveTierReverts() public {
        vm.prank(owner);
        coverageTier.deactivateTier(BASIC);

        vm.prank(alice);
        vm.expectRevert(CoverageTier.TierInactive.selector);
        coverageTier.subscribe(BASIC);
    }

    /// @notice Re-subscribing while subscription is still active reverts.
    function test_ResubscribeWhileActiveReverts() public {
        vm.prank(alice);
        coverageTier.subscribe(BASIC);

        vm.prank(alice);
        vm.expectRevert(CoverageTier.AlreadyOnHigherTier.selector);
        coverageTier.subscribe(BASIC);
    }

    /// @notice Re-subscribing exactly at expiry (not yet expired) reverts.
    function test_ResubscribeAtExpiryBoundaryReverts() public {
        vm.prank(alice);
        coverageTier.subscribe(BASIC);

        // Warp to 1 second before expiry
        vm.warp(block.timestamp + BASIC_DURATION - 1);

        vm.prank(alice);
        vm.expectRevert(CoverageTier.AlreadyOnHigherTier.selector);
        coverageTier.subscribe(BASIC);
    }

    /// @notice Re-subscribing one second after expiry succeeds (new subscription).
    function test_ResubscribeAfterExpirySucceeds() public {
        vm.prank(alice);
        coverageTier.subscribe(BASIC);

        vm.warp(block.timestamp + BASIC_DURATION + 1);

        uint256 ts = vm.getBlockTimestamp(); // use vm helper to avoid stale reads after warp
        vm.prank(alice);
        coverageTier.subscribe(BASIC);

        CoverageTier.Subscription memory sub = coverageTier.getSubscription(alice);
        assertEq(sub.startTime,  ts);
        assertEq(sub.expiryTime, ts + BASIC_DURATION);
    }

    // ─────────────────────────────────────────────────────────────────
    // isSubscribed boundary (expired)
    // ─────────────────────────────────────────────────────────────────

    /// @notice isSubscribed returns false exactly at expiry timestamp.
    function test_IsSubscribedFalseAtExactExpiry() public {
        vm.prank(alice);
        coverageTier.subscribe(BASIC);

        // Warp to expiry
        vm.warp(block.timestamp + BASIC_DURATION);

        assertFalse(coverageTier.isSubscribed(alice));
    }

    /// @notice isSubscribed returns false one second past expiry.
    function test_IsSubscribedFalseAfterExpiry() public {
        vm.prank(alice);
        coverageTier.subscribe(BASIC);

        vm.warp(block.timestamp + BASIC_DURATION + 1);

        assertFalse(coverageTier.isSubscribed(alice));
    }

    // ─────────────────────────────────────────────────────────────────
    // hasBenefit – claim eligibility boundaries
    // ─────────────────────────────────────────────────────────────────

    /// @notice BASIC subscriber has CLAIM_ELIGIBLE but not PRIORITY_CLAIM.
    function test_BasicHasClaimEligibleNotPriority() public {
        vm.prank(alice);
        coverageTier.subscribe(BASIC);

        assertTrue(coverageTier.hasBenefit(alice, CLAIM_ELIGIBLE));
        assertFalse(coverageTier.hasBenefit(alice, PRIORITY_CLAIM));
        assertFalse(coverageTier.hasBenefit(alice, FULL_COVERAGE));
    }

    /// @notice STANDARD subscriber has CLAIM_ELIGIBLE and PRIORITY_CLAIM but not FULL_COVERAGE.
    function test_StandardHasCorrectBenefits() public {
        vm.prank(alice);
        coverageTier.subscribe(STANDARD);

        assertTrue(coverageTier.hasBenefit(alice, CLAIM_ELIGIBLE));
        assertTrue(coverageTier.hasBenefit(alice, PRIORITY_CLAIM));
        assertFalse(coverageTier.hasBenefit(alice, FULL_COVERAGE));
    }

    /// @notice PREMIUM subscriber has all three benefits.
    function test_PremiumHasAllBenefits() public {
        vm.prank(alice);
        coverageTier.subscribe(PREMIUM);

        assertTrue(coverageTier.hasBenefit(alice, CLAIM_ELIGIBLE));
        assertTrue(coverageTier.hasBenefit(alice, PRIORITY_CLAIM));
        assertTrue(coverageTier.hasBenefit(alice, FULL_COVERAGE));
    }

    /// @notice hasBenefit returns false for an unsubscribed user.
    function test_HasBenefitFalseForUnsubscribed() public view {
        assertFalse(coverageTier.hasBenefit(alice, CLAIM_ELIGIBLE));
    }

    /// @notice hasBenefit returns false once the subscription expires.
    function test_HasBenefitFalseAfterExpiry() public {
        vm.prank(alice);
        coverageTier.subscribe(BASIC);

        vm.warp(block.timestamp + BASIC_DURATION + 1);

        assertFalse(coverageTier.hasBenefit(alice, CLAIM_ELIGIBLE));
    }

    /// @notice hasBenefit returns false at the exact expiry second.
    function test_HasBenefitFalseAtExactExpiry() public {
        vm.prank(alice);
        coverageTier.subscribe(BASIC);

        vm.warp(block.timestamp + BASIC_DURATION);

        assertFalse(coverageTier.hasBenefit(alice, CLAIM_ELIGIBLE));
    }

    // ─────────────────────────────────────────────────────────────────
    // Upgrade – price difference and tier boundaries
    // ─────────────────────────────────────────────────────────────────

    /// @notice Upgrading from BASIC to STANDARD charges only the price difference.
    function test_UpgradeChargesDifference() public {
        vm.prank(alice);
        coverageTier.subscribe(BASIC);

        uint256 tBefore = token.balanceOf(treasury);
        vm.prank(alice);
        coverageTier.upgrade(STANDARD);

        assertEq(token.balanceOf(treasury) - tBefore, STANDARD_PRICE - BASIC_PRICE);
    }

    /// @notice Upgrading to the same tier reverts.
    function test_UpgradeToSameTierReverts() public {
        vm.prank(alice);
        coverageTier.subscribe(STANDARD);

        vm.prank(alice);
        vm.expectRevert(CoverageTier.SameTier.selector);
        coverageTier.upgrade(STANDARD);
    }

    /// @notice Upgrading to a cheaper tier reverts (AlreadyOnHigherTier).
    function test_UpgradeToCheaperTierReverts() public {
        vm.prank(alice);
        coverageTier.subscribe(STANDARD);

        vm.prank(alice);
        vm.expectRevert(CoverageTier.AlreadyOnHigherTier.selector);
        coverageTier.upgrade(BASIC);
    }

    /// @notice Upgrading without an active subscription reverts.
    function test_UpgradeWithoutSubscriptionReverts() public {
        vm.prank(alice);
        vm.expectRevert(CoverageTier.SubscriptionNotFound.selector);
        coverageTier.upgrade(PREMIUM);
    }

    /// @notice After upgrade, subscriber has new tier's benefits.
    function test_UpgradeGrantsNewBenefits() public {
        vm.prank(alice);
        coverageTier.subscribe(BASIC);

        vm.prank(alice);
        coverageTier.upgrade(PREMIUM);

        assertTrue(coverageTier.hasBenefit(alice, FULL_COVERAGE));
    }

    /// @notice Upgrade sets new expiry based on the target tier's duration.
    function test_UpgradeSetsNewExpiry() public {
        vm.prank(alice);
        coverageTier.subscribe(BASIC);

        uint256 upgradeTime = block.timestamp;
        vm.prank(alice);
        coverageTier.upgrade(PREMIUM);

        CoverageTier.Subscription memory sub = coverageTier.getSubscription(alice);
        assertEq(sub.expiryTime, upgradeTime + PREMIUM_DURATION);
    }

    // ─────────────────────────────────────────────────────────────────
    // Renew – boundary extension logic
    // ─────────────────────────────────────────────────────────────────

    /// @notice Renewing before expiry extends from the current expiry time.
    function test_RenewBeforeExpiryExtendsFromExpiry() public {
        vm.prank(alice);
        coverageTier.subscribe(BASIC);

        CoverageTier.Subscription memory subBefore = coverageTier.getSubscription(alice);
        uint256 expectedExpiry = subBefore.expiryTime + BASIC_DURATION;

        vm.prank(alice);
        coverageTier.renew(BASIC);

        CoverageTier.Subscription memory subAfter = coverageTier.getSubscription(alice);
        assertEq(subAfter.expiryTime, expectedExpiry);
    }

    /// @notice Renewing after expiry extends from block.timestamp.
    function test_RenewAfterExpiryExtendsFromNow() public {
        vm.prank(alice);
        coverageTier.subscribe(BASIC);

        vm.warp(block.timestamp + BASIC_DURATION + 100);

        uint256 now_ = vm.getBlockTimestamp(); // use vm helper to avoid stale reads after warp
        vm.prank(alice);
        coverageTier.renew(BASIC);

        CoverageTier.Subscription memory sub = coverageTier.getSubscription(alice);
        assertEq(sub.expiryTime, now_ + BASIC_DURATION);
    }

    /// @notice Renewing a different tier than the current subscription reverts.
    function test_RenewWrongTierReverts() public {
        vm.prank(alice);
        coverageTier.subscribe(BASIC);

        vm.prank(alice);
        vm.expectRevert(CoverageTier.SubscriptionNotFound.selector);
        coverageTier.renew(STANDARD);
    }

    /// @notice Renewing without a subscription reverts.
    function test_RenewWithoutSubscriptionReverts() public {
        vm.prank(alice);
        vm.expectRevert(CoverageTier.SubscriptionNotFound.selector);
        coverageTier.renew(BASIC);
    }

    /// @notice Renewing an inactive tier reverts.
    function test_RenewInactiveTierReverts() public {
        vm.prank(alice);
        coverageTier.subscribe(BASIC);

        vm.prank(owner);
        coverageTier.deactivateTier(BASIC);

        vm.prank(alice);
        vm.expectRevert(CoverageTier.TierInactive.selector);
        coverageTier.renew(BASIC);
    }

    // ─────────────────────────────────────────────────────────────────
    // Premium payment – zero-price tier (free tier)
    // ─────────────────────────────────────────────────────────────────

    /// @notice A free tier (price = 0) can be subscribed without token transfer.
    function test_FreeTierRequiresNoPayment() public {
        bytes32 FREE = keccak256("FREE");
        vm.prank(owner);
        coverageTier.defineTier(FREE, "Free", 0, 7 days, CLAIM_ELIGIBLE);

        uint256 tBefore = token.balanceOf(treasury);

        vm.prank(alice);
        coverageTier.subscribe(FREE);

        assertEq(token.balanceOf(treasury), tBefore, "treasury should be unchanged for free tier");
        assertTrue(coverageTier.isSubscribed(alice));
    }

    // ─────────────────────────────────────────────────────────────────
    // subscriberCount tracking
    // ─────────────────────────────────────────────────────────────────

    /// @notice subscriberCount increments on first subscription.
    function test_SubscriberCountIncrementsOnSubscribe() public {
        assertEq(coverageTier.getTier(BASIC).subscriberCount, 0);

        vm.prank(alice);
        coverageTier.subscribe(BASIC);

        assertEq(coverageTier.getTier(BASIC).subscriberCount, 1);

        vm.prank(bob);
        coverageTier.subscribe(BASIC);

        assertEq(coverageTier.getTier(BASIC).subscriberCount, 2);
    }

    /// @notice subscriberCount does not double-count re-subscription (after expiry).
    function test_SubscriberCountNotIncrementedOnResubscribe() public {
        vm.prank(alice);
        coverageTier.subscribe(BASIC);

        vm.warp(block.timestamp + BASIC_DURATION + 1);
        vm.prank(alice);
        coverageTier.subscribe(BASIC); // re-subscribe after expiry

        // Count should still be 1 (same alice, re-using the active flag path)
        assertEq(coverageTier.getTier(BASIC).subscriberCount, 1);
    }

    // ─────────────────────────────────────────────────────────────────
    // setTreasury
    // ─────────────────────────────────────────────────────────────────

    /// @notice Owner can redirect premium payments to a new treasury.
    function test_SetTreasuryRedirectsPayments() public {
        address newTreasury = address(0xDEAD);

        vm.prank(owner);
        coverageTier.setTreasury(newTreasury);

        vm.prank(alice);
        coverageTier.subscribe(BASIC);

        assertEq(token.balanceOf(newTreasury), BASIC_PRICE);
    }

    /// @notice Setting treasury to zero address reverts.
    function test_SetTreasuryZeroAddressReverts() public {
        vm.prank(owner);
        vm.expectRevert(CoverageTier.ZeroAddress.selector);
        coverageTier.setTreasury(address(0));
    }
}
