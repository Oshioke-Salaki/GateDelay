// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Blacklist.sol";
import "../src/Whitelist.sol";

// ---------------------------------------------------------------------------
// Harnesses that compose Blacklist and Whitelist into simulated market actions
// ---------------------------------------------------------------------------

/// @dev Simulated trade router that checks both blacklist and whitelist before
///      executing a trade, a withdrawal, a bridge call, or a payout claim.
///      This pattern mirrors how a real market contract would integrate the two
///      access-control primitives.
contract RestrictedMarketHarness {
    Blacklist public immutable blacklist;
    Whitelist public immutable whitelist;

    error BlacklistedCaller();
    error NotWhitelistedCaller();

    constructor(address _blacklist, address _whitelist) {
        blacklist = Blacklist(_blacklist);
        whitelist = Whitelist(_whitelist);
    }

    // Internal gate: revert if caller is blacklisted or not whitelisted.
    function _gate(address caller) internal view {
        if (blacklist.isBlacklisted(caller)) revert BlacklistedCaller();
        if (!whitelist.isWhitelisted(caller)) revert NotWhitelistedCaller();
    }

    function trade(uint256 /*amount*/) external view returns (bool) {
        _gate(msg.sender);
        return true;
    }

    function withdraw(uint256 /*amount*/) external view returns (bool) {
        _gate(msg.sender);
        return true;
    }

    function bridgeOut(uint256 /*amount*/) external view returns (bool) {
        _gate(msg.sender);
        return true;
    }

    function claimPayout(uint256 /*marketId*/) external view returns (bool) {
        _gate(msg.sender);
        return true;
    }
}

/// @dev A market that only checks the blacklist (no whitelist requirement).
///      Used to isolate blacklist-only scenarios.
contract BlacklistOnlyMarketHarness {
    Blacklist public immutable blacklist;

    constructor(address _blacklist) {
        blacklist = Blacklist(_blacklist);
    }

    function _requireNotBlacklisted(address caller) internal view {
        blacklist.requireNotBlacklisted(caller);
    }

    function trade(uint256 /*amount*/) external view returns (bool) {
        _requireNotBlacklisted(msg.sender);
        return true;
    }

    function withdraw(uint256 /*amount*/) external view returns (bool) {
        _requireNotBlacklisted(msg.sender);
        return true;
    }

    function bridgeOut(uint256 /*amount*/) external view returns (bool) {
        _requireNotBlacklisted(msg.sender);
        return true;
    }

    function claimPayout(uint256 /*marketId*/) external view returns (bool) {
        _requireNotBlacklisted(msg.sender);
        return true;
    }
}

/// @dev A market that only checks the whitelist (no blacklist check).
contract WhitelistOnlyMarketHarness is Whitelist {
    constructor(address initialOwner) Whitelist(initialOwner) {}

    function trade(uint256 /*amount*/) external view onlyWhitelistedCaller returns (bool) {
        return true;
    }

    function withdraw(uint256 /*amount*/) external view onlyWhitelistedCaller returns (bool) {
        return true;
    }

    function bridgeOut(uint256 /*amount*/) external view onlyWhitelistedCaller returns (bool) {
        return true;
    }

    function claimPayout(uint256 /*marketId*/) external view onlyWhitelistedCaller returns (bool) {
        return true;
    }
}

// ---------------------------------------------------------------------------
// Tests – issue #971
// ---------------------------------------------------------------------------
contract BlacklistWhitelistInteractionTest is Test {
    Blacklist        blacklistContract;
    Whitelist        whitelistContract;
    RestrictedMarketHarness   market;      // both checks
    BlacklistOnlyMarketHarness blMarket;   // blacklist-only
    WhitelistOnlyMarketHarness wlMarket;   // whitelist-only

    address owner   = address(0xA11CE);
    address alice   = address(0xBEEF);   // normally whitelisted user
    address bob     = address(0xCAFE);   // will be blacklisted
    address carol   = address(0xD00D);   // neither listed
    address dave    = address(0xFACE);   // used for batch tests

    function setUp() public {
        vm.startPrank(owner);

        // Deploy standalone Blacklist (Ownable(msg.sender) in constructor)
        blacklistContract = new Blacklist();

        // Deploy standalone Whitelist
        whitelistContract = new Whitelist(owner);

        // Deploy harnesses
        market   = new RestrictedMarketHarness(address(blacklistContract), address(whitelistContract));
        blMarket = new BlacklistOnlyMarketHarness(address(blacklistContract));
        wlMarket = new WhitelistOnlyMarketHarness(owner);

        // Whitelist alice on both whitelist-aware markets
        whitelistContract.whitelist(alice);
        wlMarket.whitelist(alice);

        vm.stopPrank();
    }

    // ─────────────────────────────────────────────────────────────────
    // Blacklist-only market: restricted trading
    // ─────────────────────────────────────────────────────────────────

    /// @notice Non-blacklisted user can trade on a blacklist-only market.
    function test_NonBlacklistedCanTradeOnBlacklistMarket() public {
        vm.prank(alice);
        assertTrue(blMarket.trade(100));
    }

    /// @notice Blacklisted user is blocked from trading.
    function test_BlacklistedCannotTrade() public {
        vm.prank(owner);
        blacklistContract.blacklist(bob);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Blacklist.BlacklistedAccount.selector, bob));
        blMarket.trade(100);
    }

    /// @notice Blacklisted user is blocked from withdrawing.
    function test_BlacklistedCannotWithdraw() public {
        vm.prank(owner);
        blacklistContract.blacklist(bob);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Blacklist.BlacklistedAccount.selector, bob));
        blMarket.withdraw(50);
    }

    /// @notice Blacklisted user is blocked from bridging out.
    function test_BlacklistedCannotBridge() public {
        vm.prank(owner);
        blacklistContract.blacklist(bob);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Blacklist.BlacklistedAccount.selector, bob));
        blMarket.bridgeOut(200);
    }

    /// @notice Blacklisted user is blocked from claiming a payout.
    function test_BlacklistedCannotClaimPayout() public {
        vm.prank(owner);
        blacklistContract.blacklist(bob);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Blacklist.BlacklistedAccount.selector, bob));
        blMarket.claimPayout(1);
    }

    /// @notice After un-blacklisting, the user can trade again.
    function test_UnblacklistedUserCanTradeAgain() public {
        vm.startPrank(owner);
        blacklistContract.blacklist(bob);
        blacklistContract.unblacklist(bob);
        vm.stopPrank();

        vm.prank(bob);
        assertTrue(blMarket.trade(100));
    }

    // ─────────────────────────────────────────────────────────────────
    // Whitelist-only market: restricted trading
    // ─────────────────────────────────────────────────────────────────

    /// @notice Whitelisted user can trade on a whitelist-only market.
    function test_WhitelistedCanTrade() public {
        vm.prank(alice);
        assertTrue(wlMarket.trade(100));
    }

    /// @notice Non-whitelisted user is blocked from trading.
    function test_NonWhitelistedCannotTrade() public {
        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(Whitelist.NotWhitelisted.selector, carol));
        wlMarket.trade(100);
    }

    /// @notice Non-whitelisted user is blocked from withdrawing.
    function test_NonWhitelistedCannotWithdraw() public {
        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(Whitelist.NotWhitelisted.selector, carol));
        wlMarket.withdraw(50);
    }

    /// @notice Non-whitelisted user is blocked from bridging out.
    function test_NonWhitelistedCannotBridge() public {
        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(Whitelist.NotWhitelisted.selector, carol));
        wlMarket.bridgeOut(200);
    }

    /// @notice Non-whitelisted user is blocked from claiming a payout.
    function test_NonWhitelistedCannotClaimPayout() public {
        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(Whitelist.NotWhitelisted.selector, carol));
        wlMarket.claimPayout(1);
    }

    /// @notice After whitelisting, the user can access all market functions.
    function test_WhitelistedUserCanAccessAllFunctions() public {
        vm.prank(owner);
        wlMarket.whitelist(carol);

        vm.startPrank(carol);
        assertTrue(wlMarket.trade(10));
        assertTrue(wlMarket.withdraw(5));
        assertTrue(wlMarket.bridgeOut(20));
        assertTrue(wlMarket.claimPayout(1));
        vm.stopPrank();
    }

    /// @notice After un-whitelisting, the user is blocked on all market functions.
    function test_UnwhitelistedUserIsBlockedOnAllFunctions() public {
        vm.prank(owner);
        wlMarket.unwhitelist(alice);

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(Whitelist.NotWhitelisted.selector, alice));
        wlMarket.trade(10);
        vm.stopPrank();

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(Whitelist.NotWhitelisted.selector, alice));
        wlMarket.withdraw(10);
        vm.stopPrank();
    }

    // ─────────────────────────────────────────────────────────────────
    // Combined market: both blacklist and whitelist must pass
    // ─────────────────────────────────────────────────────────────────

    /// @notice Whitelisted and non-blacklisted user can access the combined market.
    function test_CombinedMarket_AllowsWhitelistedNonBlacklisted() public {
        vm.prank(alice);
        assertTrue(market.trade(100));
    }

    /// @notice Blacklisted user is blocked even if they are whitelisted.
    function test_CombinedMarket_BlacklistedBlockedEvenIfWhitelisted() public {
        // alice is whitelisted; blacklist her
        vm.prank(owner);
        blacklistContract.blacklist(alice);

        vm.prank(alice);
        vm.expectRevert(RestrictedMarketHarness.BlacklistedCaller.selector);
        market.trade(100);
    }

    /// @notice Non-whitelisted user is blocked even if not blacklisted.
    function test_CombinedMarket_NonWhitelistedBlocked() public {
        // carol is not blacklisted but also not whitelisted
        vm.prank(carol);
        vm.expectRevert(RestrictedMarketHarness.NotWhitelistedCaller.selector);
        market.trade(100);
    }

    /// @notice Both checks must pass for withdrawal on combined market.
    function test_CombinedMarket_WithdrawalRequiresBothChecks() public {
        // Pass: alice is whitelisted and not blacklisted
        vm.prank(alice);
        assertTrue(market.withdraw(50));

        // Fail: blacklist alice
        vm.prank(owner);
        blacklistContract.blacklist(alice);

        vm.prank(alice);
        vm.expectRevert(RestrictedMarketHarness.BlacklistedCaller.selector);
        market.withdraw(50);
    }

    /// @notice Both checks must pass for bridge on combined market.
    function test_CombinedMarket_BridgeRequiresBothChecks() public {
        vm.prank(alice);
        assertTrue(market.bridgeOut(100));

        vm.prank(owner);
        whitelistContract.unwhitelist(alice); // remove whitelist

        vm.prank(alice);
        vm.expectRevert(RestrictedMarketHarness.NotWhitelistedCaller.selector);
        market.bridgeOut(100);
    }

    /// @notice Both checks must pass for payout claim on combined market.
    function test_CombinedMarket_PayoutRequiresBothChecks() public {
        vm.prank(alice);
        assertTrue(market.claimPayout(1));

        vm.prank(owner);
        blacklistContract.blacklist(alice);

        vm.prank(alice);
        vm.expectRevert(RestrictedMarketHarness.BlacklistedCaller.selector);
        market.claimPayout(1);
    }

    // ─────────────────────────────────────────────────────────────────
    // Batch operations consistency
    // ─────────────────────────────────────────────────────────────────

    /// @notice Batch blacklisting blocks all targeted users.
    function test_BatchBlacklistBlocksAll() public {
        address[] memory targets = new address[](2);
        targets[0] = alice;
        targets[1] = bob;

        vm.prank(owner);
        blacklistContract.blacklistBatch(targets);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Blacklist.BlacklistedAccount.selector, alice));
        blMarket.trade(10);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Blacklist.BlacklistedAccount.selector, bob));
        blMarket.trade(10);
    }

    /// @notice Batch whitelisting allows all targeted users.
    function test_BatchWhitelistAllowsAll() public {
        address[] memory targets = new address[](2);
        targets[0] = carol;
        targets[1] = dave;

        vm.prank(owner);
        wlMarket.whitelistBatch(targets);

        vm.prank(carol);
        assertTrue(wlMarket.trade(10));

        vm.prank(dave);
        assertTrue(wlMarket.trade(10));
    }

    /// @notice Batch un-whitelist revokes access for all targeted users.
    function test_BatchUnwhitelistRevokesAll() public {
        address[] memory targets = new address[](2);
        targets[0] = carol;
        targets[1] = dave;

        vm.prank(owner);
        wlMarket.whitelistBatch(targets);

        vm.prank(owner);
        wlMarket.unwhitelistBatch(targets);

        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(Whitelist.NotWhitelisted.selector, carol));
        wlMarket.trade(10);

        vm.prank(dave);
        vm.expectRevert(abi.encodeWithSelector(Whitelist.NotWhitelisted.selector, dave));
        wlMarket.trade(10);
    }

    // ─────────────────────────────────────────────────────────────────
    // Edge cases: zero-address and duplicate management
    // ─────────────────────────────────────────────────────────────────

    /// @notice Blacklisting zero address reverts.
    function test_CannotBlacklistZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(Blacklist.InvalidAddress.selector);
        blacklistContract.blacklist(address(0));
    }

    /// @notice Whitelisting zero address reverts.
    function test_CannotWhitelistZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(Whitelist.ZeroAddress.selector);
        whitelistContract.whitelist(address(0));
    }

    /// @notice Double blacklisting the same address reverts.
    function test_CannotBlacklistTwice() public {
        vm.startPrank(owner);
        blacklistContract.blacklist(bob);
        vm.expectRevert(abi.encodeWithSelector(Blacklist.AlreadyBlacklisted.selector, bob));
        blacklistContract.blacklist(bob);
        vm.stopPrank();
    }

    /// @notice Double whitelisting the same address reverts.
    function test_CannotWhitelistTwice() public {
        vm.startPrank(owner);
        vm.expectRevert(abi.encodeWithSelector(Whitelist.AlreadyWhitelisted.selector, alice));
        whitelistContract.whitelist(alice); // alice is already whitelisted in setUp
        vm.stopPrank();
    }

    /// @notice Unblacklisting an address not on the blacklist reverts.
    function test_CannotUnblacklistUnknown() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Blacklist.NotBlacklisted.selector, carol));
        blacklistContract.unblacklist(carol);
    }

    /// @notice Unwhitelisting an address not on the whitelist reverts.
    function test_CannotUnwhitelistUnknown() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Whitelist.NotWhitelisted.selector, carol));
        whitelistContract.unwhitelist(carol);
    }

    // ─────────────────────────────────────────────────────────────────
    // requireNotBlacklisted / requireWhitelisted external helpers
    // ─────────────────────────────────────────────────────────────────

    /// @notice requireNotBlacklisted passes for clean addresses.
    function test_RequireNotBlacklistedPassesForCleanAddress() public view {
        blacklistContract.requireNotBlacklisted(alice);   // should not revert
        blacklistContract.requireNotBlacklisted(carol);   // should not revert
    }

    /// @notice requireNotBlacklisted reverts for blacklisted addresses.
    function test_RequireNotBlacklistedRevertsForBlacklisted() public {
        vm.prank(owner);
        blacklistContract.blacklist(bob);

        vm.expectRevert(abi.encodeWithSelector(Blacklist.BlacklistedAccount.selector, bob));
        blacklistContract.requireNotBlacklisted(bob);
    }

    /// @notice requireWhitelisted passes for whitelisted addresses.
    function test_RequireWhitelistedPassesForWhitelisted() public view {
        whitelistContract.requireWhitelisted(alice);      // should not revert
    }

    /// @notice requireWhitelisted reverts for non-whitelisted addresses.
    function test_RequireWhitelistedRevertsForNonWhitelisted() public {
        vm.expectRevert(abi.encodeWithSelector(Whitelist.NotWhitelisted.selector, carol));
        whitelistContract.requireWhitelisted(carol);
    }
}
