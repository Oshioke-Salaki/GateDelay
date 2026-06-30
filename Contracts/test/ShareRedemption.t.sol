// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ShareRedemption} from "../contracts/ShareRedemption.sol";

// ─── Mock tokens ──────────────────────────────────────────────────────────────

contract MockShare is ERC20 {
    constructor() ERC20("Market Share", "MS") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract MockUnderlying is ERC20 {
    constructor() ERC20("USD Collateral", "USDC") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

// ─── Test suite ───────────────────────────────────────────────────────────────

contract ShareRedemptionTest is Test {
    // ── Actors ────────────────────────────────────────────────────────────────
    address owner        = makeAddr("owner");
    address alice        = makeAddr("alice");
    address bob          = makeAddr("bob");
    address feeRecipient = makeAddr("feeRecipient");

    // ── Contracts ─────────────────────────────────────────────────────────────
    MockShare      shareToken;
    MockUnderlying usdc;
    ShareRedemption redemption;

    // ── Defaults ──────────────────────────────────────────────────────────────
    uint256 constant RATE_WAD  = 1e18;     // 1 share = 1 underlying (1:1)
    uint256 constant FEE_BPS   = 100;      // 1 % fee
    uint256 constant FULL_BPS  = 10_000;   // 100 %

    // ─────────────────────────────────────────────────────────────────────────

    function setUp() public {
        shareToken = new MockShare();
        usdc       = new MockUnderlying();
        redemption = new ShareRedemption(
            owner,
            address(shareToken),
            address(usdc),
            RATE_WAD,
            FEE_BPS,
            feeRecipient
        );

        // Seed contract with underlying liquidity
        usdc.mint(address(redemption), 100_000 ether);

        // Seed users with shares
        _mintAndApproveShares(alice, 10_000 ether);
        _mintAndApproveShares(bob,   10_000 ether);
    }

    function _mintAndApproveShares(address user, uint256 amount) internal {
        shareToken.mint(user, amount);
        vm.prank(user);
        shareToken.approve(address(redemption), type(uint256).max);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Deployment
    // ─────────────────────────────────────────────────────────────────────────

    function test_InitialState() public view {
        assertEq(address(redemption.shareToken()),      address(shareToken));
        assertEq(address(redemption.underlyingToken()), address(usdc));
        assertEq(redemption.redemptionRateWad(), RATE_WAD);
        assertEq(redemption.feeBps(), FEE_BPS);
        assertEq(redemption.feeRecipient(), feeRecipient);
        assertFalse(redemption.paused());
        assertEq(redemption.totalRedemptions(), 0);
        assertEq(redemption.totalRedeemedValue(), 0);
    }

    function test_RevertOnZeroShareToken() public {
        vm.expectRevert(ShareRedemption.ZeroAddress.selector);
        new ShareRedemption(owner, address(0), address(usdc), RATE_WAD, 0, address(0));
    }

    function test_RevertOnZeroUnderlying() public {
        vm.expectRevert(ShareRedemption.ZeroAddress.selector);
        new ShareRedemption(owner, address(shareToken), address(0), RATE_WAD, 0, address(0));
    }

    function test_RevertOnZeroRate() public {
        vm.expectRevert(ShareRedemption.InvalidRedemptionRate.selector);
        new ShareRedemption(owner, address(shareToken), address(usdc), 0, 0, address(0));
    }

    function test_RevertOnFeeTooHigh() public {
        vm.expectRevert(ShareRedemption.InvalidPartialFraction.selector);
        new ShareRedemption(owner, address(shareToken), address(usdc), RATE_WAD, 501, address(0));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Request redemption – full
    // ─────────────────────────────────────────────────────────────────────────

    function test_FullRedemptionRequest() public {
        vm.prank(alice);
        uint256 id = redemption.requestRedemption(1_000 ether, FULL_BPS);

        ShareRedemption.RedemptionRequest memory r = redemption.getRedemption(id);
        assertEq(r.id, id);
        assertEq(r.user, alice);
        assertEq(r.sharesRequested,  1_000 ether);
        assertEq(r.sharesRedeemed,   1_000 ether);
        assertEq(r.redemptionValue,  1_000 ether); // rate = 1:1
        assertFalse(r.isPartial);
        assertEq(uint8(r.status), uint8(ShareRedemption.RedemptionStatus.PENDING));
    }

    function test_FullRequestPullsSharesFromUser() public {
        vm.prank(alice);
        redemption.requestRedemption(500 ether, FULL_BPS);
        assertEq(shareToken.balanceOf(alice), 9_500 ether);
        assertEq(shareToken.balanceOf(address(redemption)), 500 ether);
    }

    function test_RequestRevertsOnInsufficientShares() public {
        vm.prank(alice);
        vm.expectRevert(ShareRedemption.InsufficientShares.selector);
        redemption.requestRedemption(50_000 ether, FULL_BPS);
    }

    function test_RequestRevertsWhenPaused() public {
        vm.prank(owner);
        redemption.setPaused(true);

        vm.prank(alice);
        vm.expectRevert(ShareRedemption.ContractPaused.selector);
        redemption.requestRedemption(100 ether, FULL_BPS);
    }

    function test_RequestRevertsOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(ShareRedemption.ZeroAmount.selector);
        redemption.requestRedemption(0, FULL_BPS);
    }

    function test_RequestRevertsOnInvalidPartialBps() public {
        vm.prank(alice);
        vm.expectRevert(ShareRedemption.InvalidPartialFraction.selector);
        redemption.requestRedemption(100 ether, 0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Partial redemptions
    // ─────────────────────────────────────────────────────────────────────────

    function test_PartialRedemptionRequest() public {
        vm.prank(alice);
        uint256 id = redemption.requestRedemption(1_000 ether, 5_000); // 50 %

        ShareRedemption.RedemptionRequest memory r = redemption.getRedemption(id);
        assertEq(r.sharesRequested,  1_000 ether);
        assertEq(r.sharesRedeemed,   500 ether);
        assertEq(r.redemptionValue,  500 ether);
        assertTrue(r.isPartial);
    }

    function test_PartialRequestReturnsSurplusImmediately() public {
        // 50 %: 500 locked, 500 returned immediately
        vm.prank(alice);
        redemption.requestRedemption(1_000 ether, 5_000);
        // alice had 10_000, submitted 1_000, 500 returned → 9_500
        assertEq(shareToken.balanceOf(alice), 9_500 ether);
        assertEq(shareToken.balanceOf(address(redemption)), 500 ether);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Redemption value calculation
    // ─────────────────────────────────────────────────────────────────────────

    function test_RedemptionValueAtTwoXRate() public {
        vm.prank(owner);
        redemption.setRedemptionRate(2e18); // 2:1

        vm.prank(alice);
        uint256 id = redemption.requestRedemption(500 ether, FULL_BPS);

        ShareRedemption.RedemptionRequest memory r = redemption.getRedemption(id);
        // 500 shares * 2 = 1000 gross
        assertEq(r.redemptionValue, 1_000 ether);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § History tracking
    // ─────────────────────────────────────────────────────────────────────────

    function test_RedemptionHistoryTracked() public {
        vm.prank(alice);
        redemption.requestRedemption(100 ether, FULL_BPS);
        vm.prank(alice);
        redemption.requestRedemption(200 ether, FULL_BPS);

        uint256[] memory ids = redemption.userRedemptionIds(alice);
        assertEq(ids.length, 2);
        assertEq(redemption.totalRedemptions(), 2);
        assertEq(redemption.userRedemptionCount(alice), 2);
    }

    function test_TotalRedeemedValueAccumulates() public {
        vm.prank(alice);
        uint256 id = redemption.requestRedemption(1_000 ether, FULL_BPS);

        vm.prank(alice);
        redemption.executeRedemption(id);

        // net = 1000 - 1% fee = 990
        assertEq(redemption.totalRedeemedValue(), 990 ether);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Execute redemption
    // ─────────────────────────────────────────────────────────────────────────

    function test_ExecuteTransfersNetValueToUser() public {
        vm.prank(alice);
        uint256 id = redemption.requestRedemption(1_000 ether, FULL_BPS);

        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        redemption.executeRedemption(id);

        uint256 net = 1_000 ether - (1_000 ether * FEE_BPS / 10_000);
        assertEq(usdc.balanceOf(alice) - before, net);
    }

    function test_ExecuteTransfersFeeToFeeRecipient() public {
        vm.prank(alice);
        uint256 id = redemption.requestRedemption(1_000 ether, FULL_BPS);

        uint256 before = usdc.balanceOf(feeRecipient);
        vm.prank(alice);
        redemption.executeRedemption(id);

        uint256 fee = 1_000 ether * FEE_BPS / 10_000;
        assertEq(usdc.balanceOf(feeRecipient) - before, fee);
    }

    function test_OwnerCanExecuteRedemption() public {
        vm.prank(alice);
        uint256 id = redemption.requestRedemption(200 ether, FULL_BPS);

        vm.prank(owner);
        redemption.executeRedemption(id);

        assertEq(uint8(redemption.statusOf(id)), uint8(ShareRedemption.RedemptionStatus.EXECUTED));
    }

    function test_ExecuteRevertsIfNotOwnerOfRedemption() public {
        vm.prank(alice);
        uint256 id = redemption.requestRedemption(200 ether, FULL_BPS);

        vm.prank(bob);
        vm.expectRevert(ShareRedemption.NotRedemptionOwner.selector);
        redemption.executeRedemption(id);
    }

    function test_CannotExecuteTwice() public {
        vm.prank(alice);
        uint256 id = redemption.requestRedemption(100 ether, FULL_BPS);
        vm.prank(alice);
        redemption.executeRedemption(id);

        vm.prank(alice);
        vm.expectRevert(ShareRedemption.RedemptionNotPending.selector);
        redemption.executeRedemption(id);
    }

    function test_ExecuteRevertsOnUnknownId() public {
        vm.prank(alice);
        vm.expectRevert(ShareRedemption.UnknownRedemption.selector);
        redemption.executeRedemption(999);
    }

    function test_ExecuteRevertsIfInsufficientLiquidity() public {
        // Create a contract with no underlying
        ShareRedemption dry = new ShareRedemption(
            owner, address(shareToken), address(usdc), RATE_WAD, 0, address(0)
        );
        shareToken.mint(alice, 100 ether);
        vm.prank(alice);
        shareToken.approve(address(dry), type(uint256).max);

        vm.prank(alice);
        uint256 id = dry.requestRedemption(100 ether, FULL_BPS);

        vm.prank(alice);
        vm.expectRevert(ShareRedemption.InsufficientPoolLiquidity.selector);
        dry.executeRedemption(id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Cancel redemption
    // ─────────────────────────────────────────────────────────────────────────

    function test_CancelRestoresShares() public {
        vm.prank(alice);
        uint256 id = redemption.requestRedemption(400 ether, FULL_BPS);
        assertEq(shareToken.balanceOf(alice), 9_600 ether);

        vm.prank(alice);
        redemption.cancelRedemption(id);

        assertEq(shareToken.balanceOf(alice), 10_000 ether);
        assertEq(uint8(redemption.statusOf(id)), uint8(ShareRedemption.RedemptionStatus.CANCELLED));
    }

    function test_CancelRevertsIfNotOwner() public {
        vm.prank(alice);
        uint256 id = redemption.requestRedemption(100 ether, FULL_BPS);

        vm.prank(bob);
        vm.expectRevert(ShareRedemption.NotRedemptionOwner.selector);
        redemption.cancelRedemption(id);
    }

    function test_CannotCancelExecuted() public {
        vm.prank(alice);
        uint256 id = redemption.requestRedemption(100 ether, FULL_BPS);
        vm.prank(alice);
        redemption.executeRedemption(id);

        vm.prank(alice);
        vm.expectRevert(ShareRedemption.RedemptionNotPending.selector);
        redemption.cancelRedemption(id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Preview queries
    // ─────────────────────────────────────────────────────────────────────────

    function test_PreviewFullRedemption() public view {
        (uint256 gross, uint256 net, uint256 fee) =
            redemption.previewRedemptionValue(1_000 ether, FULL_BPS);
        assertEq(gross, 1_000 ether);
        assertEq(fee,   10 ether);
        assertEq(net,   990 ether);
    }

    function test_PreviewPartialRedemption() public view {
        (uint256 gross, uint256 net, uint256 fee) =
            redemption.previewRedemptionValue(1_000 ether, 5_000); // 50 %
        assertEq(gross, 500 ether);
        assertEq(fee,   5 ether);
        assertEq(net,   495 ether);
    }

    function test_PreviewRevertsOnInvalidBps() public {
        vm.expectRevert(ShareRedemption.InvalidPartialFraction.selector);
        redemption.previewRedemptionValue(100 ether, 0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Admin
    // ─────────────────────────────────────────────────────────────────────────

    function test_OwnerCanUpdateRate() public {
        vm.prank(owner);
        redemption.setRedemptionRate(2e18);
        assertEq(redemption.redemptionRateWad(), 2e18);
    }

    function test_NonOwnerCannotUpdateRate() public {
        vm.prank(alice);
        vm.expectRevert();
        redemption.setRedemptionRate(2e18);
    }

    function test_OwnerCanUpdateFee() public {
        vm.prank(owner);
        redemption.setFee(200);
        assertEq(redemption.feeBps(), 200);
    }

    function test_OwnerCannotSetFeeTooHigh() public {
        vm.prank(owner);
        vm.expectRevert(ShareRedemption.InvalidPartialFraction.selector);
        redemption.setFee(501);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Fuzz
    // ─────────────────────────────────────────────────────────────────────────

    function testFuzz_NetValueNeverExceedsGross(
        uint256 shares,
        uint256 partialBps
    ) public view {
        shares     = bound(shares, 1, 10_000 ether);
        partialBps = bound(partialBps, 1, 10_000);

        (uint256 gross, uint256 net, uint256 fee) =
            redemption.previewRedemptionValue(shares, partialBps);
        assertLe(net, gross);
        assertEq(net + fee, gross);
    }
}
